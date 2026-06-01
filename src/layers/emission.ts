import type { DesignIR, AppliedFix, Metrics, Violation } from '../types';

/**
 * Layer 4: deterministic emission. We rewrite ONLY the static className string
 * spans we recorded in Layer 1, so the output is byte-for-byte predictable and
 * never touches dynamic expressions. Edits are applied right-to-left so offsets
 * stay valid.
 */
export function emit(code: string, ir: DesignIR, edits: Map<string, string>): string {
  if (edits.size === 0) return code;

  const replacements: { start: number; end: number; text: string }[] = [];
  for (const site of ir.source.classSites) {
    if (!site.static) continue;
    const classes = site.raw.split(/\s+/);
    let changed = false;
    const next = classes.map((c) => {
      const r = edits.get(c);
      if (r && r !== c) { changed = true; return r; }
      return c;
    });
    if (changed) replacements.push({ start: site.start, end: site.end, text: next.join(' ') });
  }

  replacements.sort((a, b) => b.start - a.start);
  let out = code;
  for (const r of replacements) out = out.slice(0, r.start) + r.text + out.slice(r.end);
  return out;
}

export function buildReport(
  metrics: Metrics,
  violations: Violation[],
  fixes: AppliedFix[],
  suggestions: string[],
  passed: boolean,
): string {
  const L: string[] = [];
  const hard = violations.filter((v) => v.severity === 'hard');
  const soft = violations.filter((v) => v.severity === 'soft');

  L.push(`Cybernetic Design System — report`);
  L.push(`status: ${passed ? 'PASS' : 'FAIL'}   cost J=${metrics.cost}   aesthetic=${metrics.birkhoff.score}/100`);
  L.push('');
  L.push(`metrics`);
  L.push(`  birkhoff  M=${metrics.birkhoff.measure} (order ${metrics.birkhoff.order} / complexity ${metrics.birkhoff.complexity})`);
  L.push(`            order breakdown: ${JSON.stringify(metrics.birkhoff.breakdown)}`);
  L.push(`  ngo-14    symmetry=${metrics.ngo14.symmetry} cohesion=${metrics.ngo14.cohesion} balance=${metrics.ngo14.balance} equilibrium=${metrics.ngo14.equilibrium}`);
  L.push(`            sequence=${metrics.ngo14.sequence} unity=${metrics.ngo14.unity} proportion=${metrics.ngo14.proportion} simplicity=${metrics.ngo14.simplicity}`);
  L.push(`            density=${metrics.ngo14.density} regularity=${metrics.ngo14.regularity} economy=${metrics.ngo14.economy} homogeneity=${metrics.ngo14.homogeneity} rhythm=${metrics.ngo14.rhythm}`);
  if (metrics.image) {
    L.push(`  image     colorfulness=${metrics.image.colorfulness} (score ${metrics.image.colorfulnessScore}) clutter=${metrics.image.clutter} (score ${metrics.image.clutterScore})`);
  }
  L.push(`  grid      ${Math.round(metrics.gridAdherence * 100)}% on-grid`);
  L.push(`  density   ${metrics.density.interactiveCount} controls, Hick index ${metrics.density.hickIndex}, depth ${metrics.density.nestingDepth}`);
  if (metrics.contrast.length) {
    L.push(`  contrast`);
    for (const c of metrics.contrast) L.push(`    <${c.elementTag}> ${c.fg}/${c.bg} = ${c.ratio}:1 [${c.level}]`);
  }
  if (metrics.apca.length) {
    L.push(`  apca (advisory)`);
    for (const a of metrics.apca) {
      const flag = a.wcagPassApcWeak ? ' ⚠ WCAG-pass/APCA-weak' : '';
      const pass = a.passes ? '✓' : '✗';
      L.push(`    Lc=${a.lc} [${pass} ≥${a.threshold}] ${a.polarity}${flag}`);
    }
  }
  L.push('');

  if (hard.length) {
    L.push(`hard violations (${hard.length})`);
    for (const v of hard) L.push(`  ✗ [${v.rule}] ${v.message}`);
    L.push('');
  }
  if (soft.length) {
    L.push(`soft warnings (${soft.length})`);
    for (const v of soft) L.push(`  ! [${v.rule}] ${v.message}`);
    L.push('');
  }
  if (fixes.length) {
    L.push(`auto-fixed (${fixes.length})`);
    for (const f of fixes) L.push(`  ✓ ${f.before} -> ${f.after}  (${f.reason})`);
    L.push('');
  }
  if (suggestions.length) {
    L.push(`suggested (needs confirmation)`);
    for (const s of suggestions) L.push(`  → ${s}`);
    L.push('');
  }
  if (!hard.length && !soft.length && !fixes.length) L.push('clean — nothing to do.');
  return L.join('\n');
}
