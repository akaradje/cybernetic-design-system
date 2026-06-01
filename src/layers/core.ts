import type {
  DesignIR, Violation, Metrics, ContrastResult, AppliedFix,
} from '../types';
import type { DesignConfig } from '../config/tokens';
import { contrastRatio, wcagLevel, resolveColor, suggestAccessibleShade } from '../metrics/contrast';
import { evaluateAPCA } from '../metrics/apca';
import { birkhoff } from '../metrics/birkhoff';
import { ngo14 } from '../metrics/ngo';
import { computeImageMetrics, type PixelData } from '../metrics/image';
import { density } from '../metrics/density';
import { snapClass, parseSpacingClass } from '../metrics/grid';
import { evaluateCatalog } from '../constraints/catalog';

/** Pair text-* and bg-* on the same node and rate contrast. */
export function evaluateContrast(ir: DesignIR): ContrastResult[] {
  const out: ContrastResult[] = [];
  for (const node of ir.nodes) {
    const fgCls = node.classes.find((c) => c.startsWith('text-'));
    const bgCls = node.classes.find((c) => c.startsWith('bg-'));
    if (!fgCls || !bgCls) continue;
    const fg = resolveColor(fgCls.replace('text-', ''));
    const bg = resolveColor(bgCls.replace('bg-', ''));
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) continue;
    out.push({
      fg: fgCls, bg: bgCls,
      ratio: Math.round(ratio * 100) / 100,
      level: wcagLevel(ratio),
      elementTag: node.tag,
    });
  }
  return out;
}

export function computeMetrics(ir: DesignIR, cfg: DesignConfig, pixels?: PixelData | null): Metrics {
  const contrast = evaluateContrast(ir);
  const apca = evaluateAPCA(ir.nodes, contrast);
  const bk = birkhoff(ir, cfg);
  const ngo = ngo14(ir, cfg);
  const img = computeImageMetrics(pixels ?? null);
  const den = density(ir, cfg);
  const spacing = ir.tokens.spacing;
  const gridAdherence = spacing.length
    ? spacing.filter((s) => s.onGrid).length / spacing.length
    : 1;

  // Cost function J (lower = better): the CBIR objective. Hard constraints are
  // handled separately as inequalities; this scalar ranks soft quality.
  // Weights match the evidence grading in ARCHITECTURE.md §1.6:
  //   symmetry, cohesion, balance, equilibrium, sequence, unity = high weight
  //   remaining Ngo measures = low weight
  const contrastPenalty = contrast.filter((c) => c.level === 'fail').length * 3
    + contrast.filter((c) => c.level === 'AA-large').length * 1;
  const gridPenalty = (1 - gridAdherence) * 5;
  const densityPenalty = den.warnings.length * 2;
  const aestheticPenalty = (1 - bk.measure) * 4;

  // Ngo geometry penalty: weighted sum of (1 - measure) for each metric.
  // High-weight measures (evidence: replicated as most influential).
  const ngoHighWeight =
    (1 - ngo.symmetry) * 2 +
    (1 - ngo.cohesion) * 2 +
    (1 - ngo.balance) * 1.5 +
    (1 - ngo.equilibrium) * 1.5 +
    (1 - ngo.sequence) * 1.5 +
    (1 - ngo.unity) * 1.5;
  // Low-weight measures (evidence: weak–moderate).
  const ngoLowWeight =
    (1 - ngo.proportion) * 0.5 +
    (1 - ngo.simplicity) * 0.5 +
    (1 - ngo.density) * 0.5 +
    (1 - ngo.regularity) * 0.5 +
    (1 - ngo.economy) * 0.3 +
    (1 - ngo.homogeneity) * 0.3 +
    (1 - ngo.rhythm) * 0.3;

  // Image-statistic penalty (from Reinecke et al. — ~50% variance at 500ms).
  // Moderate colorfulness and moderate clutter score best.
  const imagePenalty = img
    ? (1 - img.colorfulnessScore) * 3 + (1 - img.clutterScore) * 3
    : 0;

  const cost = round(
    contrastPenalty + gridPenalty + densityPenalty + aestheticPenalty +
    ngoHighWeight + ngoLowWeight + imagePenalty,
  );

  return { contrast, apca, birkhoff: bk, ngo14: ngo, image: img, density: den, gridAdherence: round(gridAdherence), cost };
}

/** Hard + soft constraint checking via the formal catalog (M3). */
export function checkConstraints(ir: DesignIR, metrics: Metrics, cfg: DesignConfig): Violation[] {
  // Use the formal constraint catalog for most checks.
  const catalogViolations = evaluateCatalog(ir, metrics, cfg);

  // Override grid.spacing: one violation per off-grid item (catalog returns one aggregate).
  const detailedGrid = ir.tokens.spacing
    .filter((s) => !s.onGrid)
    .map((s) => ({
      severity: 'hard' as const,
      rule: 'grid.spacing',
      message: `${s.classToken} (${s.px}px) is off the 4px grid.`,
      fixable: true,
    }));

  // Override a11y.contrast: per-element detail from metrics.
  const detailedContrast = metrics.contrast
    .filter((c) => c.ratio < cfg.minContrast)
    .map((c) => ({
      severity: 'hard' as const,
      rule: 'a11y.contrast',
      message: `${c.fg} on ${c.bg} is ${c.ratio}:1 (< ${cfg.minContrast}:1) on <${c.elementTag}>.`,
      fixable: true,
    }));

  // Keep catalog violations that we haven't overridden with detailed versions.
  const rest = catalogViolations.filter(
    (v) => v.rule !== 'grid.spacing' && v.rule !== 'a11y.contrast',
  );
  return [...rest, ...detailedGrid, ...detailedContrast];
}

/**
 * Layer 3 — the "actuator". It may ONLY make moves that the constraints permit:
 *   - snap off-grid spacing to the nearest grid token (deterministic, safe)
 *   - propose (not impose) an accessible same-hue shade for failing contrast
 * Anything outside this envelope is rejected — the agent cannot warp the layout.
 */
export function refine(
  ir: DesignIR,
  metrics: Metrics,
  cfg: DesignConfig,
): { fixes: AppliedFix[]; edits: Map<string, string>; suggestions: string[] } {
  const fixes: AppliedFix[] = [];
  const edits = new Map<string, string>(); // originalClass -> replacementClass
  const suggestions: string[] = [];

  // Bounded move #1: grid snapping + arbitrary->token normalization.
  for (const s of ir.tokens.spacing) {
    const isArbitrary = s.classToken.includes('[');
    if (s.onGrid && !isArbitrary) continue; // already a clean token
    const parsed = parseSpacingClass(s.classToken);
    if (!parsed) continue;
    const replacement = snapClass(parsed, s.classToken);
    if (replacement !== s.classToken) {
      edits.set(s.classToken, replacement);
      fixes.push({
        rule: 'grid.spacing',
        before: s.classToken,
        after: replacement,
        reason: s.onGrid
          ? `Normalized arbitrary value to scale token.`
          : `Snapped ${s.px}px to the nearest grid step.`,
      });
    }
  }

  // Bounded move #2: contrast suggestions (proposed, never auto-applied —
  // recoloring can change meaning, so a human/agent confirms).
  for (const c of metrics.contrast) {
    if (c.ratio >= cfg.minContrast) continue;
    const bgHex = resolveColor(c.bg.replace('bg-', ''))!;
    const suggested = suggestAccessibleShade(c.fg.replace('text-', ''), bgHex, cfg.minContrast);
    if (suggested) {
      suggestions.push(`Replace ${c.fg} with text-${suggested} to clear ${cfg.minContrast}:1 on <${c.elementTag}>.`);
    } else {
      suggestions.push(`No same-hue shade of ${c.fg} clears ${cfg.minContrast}:1 on ${c.bg}; pick a different background or hue.`);
    }
  }

  return { fixes, edits, suggestions };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
