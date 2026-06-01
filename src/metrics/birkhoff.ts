import type { DesignIR, BirkhoffResult } from '../types';
import type { DesignConfig } from '../config/tokens';

/**
 * Birkhoff's aesthetic measure: M = O / C  (order over complexity).
 *
 * Birkhoff defined this for ornaments/polygons. For a UI we operationalize:
 *   ORDER (0..1)  = how repetitive/consistent the design language is
 *     - colorOrder:   fewer distinct colors than ideal -> higher
 *     - spacingOrder: fewer distinct spacing values -> higher
 *     - gridOrder:    share of spacing values that sit on the grid
 *   COMPLEXITY (>=1) = how much there is to parse
 *     - element count + nesting depth, normalized by reference values
 *
 * This is an explicit heuristic, not a law of nature — tune the weights.
 */
export function birkhoff(ir: DesignIR, cfg: DesignConfig): BirkhoffResult {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  const distinctColors = ir.tokens.colors;
  const spacing = ir.tokens.spacing;
  const distinctSpacingPx = [...new Set(spacing.map((s) => s.px))].sort((a, b) => a - b);
  const nestingDepth = Math.max(0, ...ir.nodes.map((n) => n.depth));

  const colorOrder = clamp01(
    1 - Math.max(0, distinctColors.length - cfg.idealDistinctColors) /
        cfg.idealDistinctColors,
  );
  const spacingOrder = clamp01(
    1 - Math.max(0, distinctSpacingPx.length - cfg.idealDistinctSpacing) /
        cfg.idealDistinctSpacing,
  );
  const totalSpacing = spacing.length || 1;
  const gridOrder = spacing.filter((s) => s.onGrid).length / totalSpacing;

  const order = (colorOrder + spacingOrder + gridOrder) / 3;

  const complexity =
    1 +
    (ir.nodes.length / cfg.refElementCount +
      nestingDepth / cfg.refNestingDepth) /
      2;

  const measure = order / complexity;
  // Map M (~0..1) to a friendlier 0..100 score.
  const score = Math.round(clamp01(measure) * 100);

  return {
    order: round(order),
    complexity: round(complexity),
    measure: round(measure),
    score,
    breakdown: {
      colorOrder: round(colorOrder),
      spacingOrder: round(spacingOrder),
      gridOrder: round(gridOrder),
    },
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
