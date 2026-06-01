import type { DesignIR, DensityResult } from '../types';
import type { DesignConfig } from '../config/tokens';

/**
 * Hick–Hyman law: decision time grows with log2(n+1) of the number of
 * roughly-equal choices. We use it as a *relative* cognitive-load index for
 * the count of interactive controls in one view, plus structural warnings.
 */
export function density(ir: DesignIR, cfg: DesignConfig): DensityResult {
  const n = ir.nodes.filter((node) => node.interactive).length;
  const nestingDepth = Math.max(0, ...ir.nodes.map((node) => node.depth));
  const hickIndex = round(Math.log2(n + 1));

  const warnings: string[] = [];
  if (n > cfg.maxInteractiveChoices) {
    warnings.push(
      `${n} interactive controls in one view (Hick's law): consider grouping or progressive disclosure (target <= ${cfg.maxInteractiveChoices}).`,
    );
  }
  if (nestingDepth > cfg.maxNestingDepth) {
    warnings.push(
      `Nesting depth ${nestingDepth} exceeds ${cfg.maxNestingDepth}: flatten the layout to reduce parse cost.`,
    );
  }

  return {
    interactiveCount: n,
    hickIndex,
    elementCount: ir.nodes.length,
    nestingDepth,
    warnings,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
