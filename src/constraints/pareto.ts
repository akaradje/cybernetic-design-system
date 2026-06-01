import type { Metrics } from '../types';

/**
 * M3 — Pareto front analysis.
 *
 * When multiple feasible candidates exist, rank by J; expose the Pareto front
 * across the top metric groups (a11y / order / complexity) so a human can pick
 * a trade-off instead of accepting a single scalarization.
 *
 * A point p dominates q iff p is at least as good in every objective and
 * strictly better in at least one.
 */

export interface MetricVector {
  /** Group label for display. */
  label: string;
  /** Accessibility score: 0..1 (contrast pass rate). */
  a11y: number;
  /** Order score: 0..1 (Birkhoff order). */
  order: number;
  /** Complexity score: 0..1 (1 = simple, 0 = complex). */
  complexity: number;
  /** Overall cost J (lower = better). */
  cost: number;
  /** The source code that produced this vector. */
  code?: string;
}

/**
 * Compute a metric vector from the pipeline output.
 * All values normalized to [0,1] where 1 = best.
 */
export function toMetricVector(label: string, metrics: Metrics, code?: string): MetricVector {
  const total = metrics.contrast.length || 1;
  const passing = metrics.contrast.filter((c) => c.ratio >= 4.5).length;
  const a11y = passing / total;

  return {
    label,
    a11y: round(a11y),
    order: round(metrics.birkhoff.order),
    complexity: round(1 / metrics.birkhoff.complexity), // invert: lower complexity = better
    cost: metrics.cost,
    code,
  };
}

/**
 * Check if `a` dominates `b` (Pareto dominance).
 * a dominates b iff a is ≥ b in every objective and > b in at least one.
 */
export function dominates(a: MetricVector, b: MetricVector): boolean {
  const objs = [a.a11y >= b.a11y, a.order >= b.order, a.complexity >= b.complexity];
  const strictObjs = [a.a11y > b.a11y, a.order > b.order, a.complexity > b.complexity];
  return objs.every(Boolean) && strictObjs.some(Boolean);
}

/**
 * Find the Pareto front from a set of metric vectors.
 * Returns the non-dominated subset.
 */
export function paretoFront(vectors: MetricVector[]): MetricVector[] {
  const front: MetricVector[] = [];
  for (const v of vectors) {
    const dominated = vectors.some((other) => other !== v && dominates(other, v));
    if (!dominated) front.push(v);
  }
  return front;
}

/**
 * Rank vectors by cost J (scalarized default).
 * The Pareto front is the inspection tool; this is the default ordering.
 */
export function rankByCost(vectors: MetricVector[]): MetricVector[] {
  return [...vectors].sort((a, b) => a.cost - b.cost);
}

/**
 * Format a Pareto front report.
 */
export function formatParetoReport(front: MetricVector[]): string {
  if (front.length === 0) return '  (no Pareto alternatives)';

  const L: string[] = [];
  L.push(`  Pareto front (${front.length} non-dominated):`);
  for (const v of front) {
    L.push(`    ${v.label}: a11y=${v.a11y} order=${v.order} complexity=${v.complexity} cost=${v.cost}`);
  }
  return L.join('\n');
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
