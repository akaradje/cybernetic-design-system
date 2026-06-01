import type { DesignIR, Violation, Metrics } from '../types';
import type { DesignConfig } from '../config/tokens';

/**
 * M3 — Formal constraint catalog.
 *
 * Each constraint g_k(s) ≤ 0 is expressed as a function that returns:
 *   - ≤ 0: feasible (constraint satisfied)
 *   - > 0: infeasible (violation magnitude)
 *
 * This is the "cage" — the hard boundary that no agent can breach.
 * Sources are cited from ARCHITECTURE.md §1.6 evidence grading.
 */

export interface ConstraintDef {
  id: string;
  severity: 'hard' | 'soft';
  metric: string;
  threshold: string;
  fixOperator: string | null;
  citation: string;
  /** Evaluate: returns ≤ 0 if feasible, > 0 if violated. */
  evaluate: (ir: DesignIR, metrics: Metrics, cfg: DesignConfig) => number;
  /** Human-readable message for a violation of magnitude `mag`. */
  message: (ir: DesignIR, mag: number, cfg: DesignConfig) => string;
}

/**
 * The canonical constraint catalog. Order matters: hard constraints first.
 * Each row maps 1:1 to the table in ARCHITECTURE.md §M3.
 */
export const CONSTRAINT_CATALOG: ConstraintDef[] = [
  // ── Hard constraints ──
  {
    id: 'grid.spacing',
    severity: 'hard',
    metric: 'grid adherence',
    threshold: 'every spacing on 4px grid',
    fixOperator: 'snapSpacing',
    citation: '§1.5 + Gestalt proximity',
    evaluate: (ir) => {
      const offGrid = ir.tokens.spacing.filter((s) => !s.onGrid);
      return offGrid.length; // > 0 means violations exist
    },
    message: (ir, _mag, _cfg) => {
      // Return only the first violation; evaluateCatalog will be called per-item
      // or we rely on the checkConstraints override for detailed per-element messages.
      const offGrid = ir.tokens.spacing.filter((s) => !s.onGrid);
      if (offGrid.length === 0) return '';
      return `${offGrid[0].classToken} (${offGrid[0].px}px) is off the 4px grid.`;
    },
  },
  {
    id: 'a11y.contrast',
    severity: 'hard',
    metric: 'WCAG 2.x contrast ratio',
    threshold: '≥ 4.5:1 normal text, ≥ 3:1 large text',
    fixOperator: 'recolorAccessible',
    citation: '§1.4 WCAG 2.1/2.2',
    evaluate: (_ir, metrics, cfg) => {
      const failing = metrics.contrast.filter((c) => c.ratio < cfg.minContrast);
      return failing.length;
    },
    message: (_ir, _mag, cfg) => {
      // This message is built from metrics in checkConstraints
      return `Contrast ratio below ${cfg.minContrast}:1`;
    },
  },
  {
    id: 'a11y.target-size',
    severity: 'hard',
    metric: 'interactive target size',
    threshold: '≥ 24px (AA) / ≥ 44px (AAA)',
    fixOperator: null,
    citation: '§1.2 Fitts / WCAG 2.5.8',
    evaluate: (ir) => {
      // In static path, we can't measure actual box sizes.
      // When dynamic perception is available, check box.w >= 24 && box.h >= 24.
      if (!ir.meta.rendered) return 0; // skip in static path
      const tooSmall = ir.nodes.filter(
        (n) => n.interactive && (n.box.w < 24 || n.box.h < 24),
      );
      return tooSmall.length;
    },
    message: (ir) => {
      const tooSmall = ir.nodes.filter(
        (n) => n.interactive && (n.box.w < 24 || n.box.h < 24),
      );
      return tooSmall.map((n) => `<${n.tag}> target ${n.box.w}×${n.box.h}px is below 24px minimum.`).join('\n');
    },
  },
  // ── Soft constraints ──
  {
    id: 'gestalt.color-count',
    severity: 'soft',
    metric: 'distinct color count',
    threshold: `≤ ${5} (configurable)`,
    fixOperator: null,
    citation: '§1.1 Gestalt similarity',
    evaluate: (ir, _metrics, cfg) => {
      return Math.max(0, ir.tokens.colors.length - cfg.idealDistinctColors);
    },
    message: (ir, _mag, cfg) => {
      return `${ir.tokens.colors.length} distinct colors (ideal <= ${cfg.idealDistinctColors}). Consolidate the palette.`;
    },
  },
  {
    id: 'gestalt.spacing-count',
    severity: 'soft',
    metric: 'distinct spacing values',
    threshold: `≤ ${6} (configurable)`,
    fixOperator: null,
    citation: '§1.1 Gestalt similarity',
    evaluate: (ir, _metrics, cfg) => {
      const distinctPx = new Set(ir.tokens.spacing.map((s) => s.px)).size;
      return Math.max(0, distinctPx - cfg.idealDistinctSpacing);
    },
    message: (ir, _mag, cfg) => {
      const distinctPx = new Set(ir.tokens.spacing.map((s) => s.px)).size;
      return `${distinctPx} distinct spacing values (ideal <= ${cfg.idealDistinctSpacing}). Reuse a smaller scale.`;
    },
  },
  {
    id: 'cognitive.load',
    severity: 'soft',
    metric: 'Hick-Hyman index',
    threshold: `≤ ${9} interactive controls (configurable)`,
    fixOperator: null,
    citation: '§1.2 Hick-Hyman',
    evaluate: (ir, _metrics, cfg) => {
      const n = ir.nodes.filter((nd) => nd.interactive).length;
      return Math.max(0, n - cfg.maxInteractiveChoices);
    },
    message: (ir, _mag, cfg) => {
      const n = ir.nodes.filter((nd) => nd.interactive).length;
      return `${n} interactive controls in one view (Hick's law): consider grouping or progressive disclosure (target <= ${cfg.maxInteractiveChoices}).`;
    },
  },
  {
    id: 'cognitive.depth',
    severity: 'soft',
    metric: 'nesting depth',
    threshold: `≤ ${6} levels (configurable)`,
    fixOperator: null,
    citation: '§1.2 Cognitive Load Theory',
    evaluate: (ir, _metrics, cfg) => {
      const maxDepth = Math.max(0, ...ir.nodes.map((n) => n.depth));
      return Math.max(0, maxDepth - cfg.maxNestingDepth);
    },
    message: (ir, _mag, cfg) => {
      const maxDepth = Math.max(0, ...ir.nodes.map((n) => n.depth));
      return `Nesting depth ${maxDepth} exceeds ${cfg.maxNestingDepth}: flatten the layout to reduce parse cost.`;
    },
  },
];

/**
 * Evaluate all constraints against the current IR.
 * Returns violations where g_k(s) > 0.
 */
export function evaluateCatalog(ir: DesignIR, metrics: Metrics, cfg: DesignConfig): Violation[] {
  const violations: Violation[] = [];

  for (const constraint of CONSTRAINT_CATALOG) {
    const mag = constraint.evaluate(ir, metrics, cfg);
    if (mag > 0) {
      violations.push({
        severity: constraint.severity,
        rule: constraint.id,
        message: constraint.message(ir, mag, cfg),
        fixable: constraint.fixOperator !== null,
      });
    }
  }

  return violations;
}

/**
 * Get constraint metadata (for reporting / introspection).
 */
export function getConstraintMeta(): Array<Omit<ConstraintDef, 'evaluate' | 'message'>> {
  return CONSTRAINT_CATALOG.map(({ evaluate: _e, message: _m, ...rest }) => rest);
}
