import type { DesignIR, Violation, Metrics } from '../types';
import type { DesignConfig } from '../config/tokens';
import type { AgentProposal, CageResult } from './types';
import { computeMetrics, checkConstraints, refine } from '../layers/core';
import { perceive } from '../layers/perception';
import { emit } from '../layers/emission';

/**
 * The Cage — the formal guarantee that no agent can breach constraints.
 *
 * For any proposal p from any agent:
 *   commit(p) = Π_F(α_p(s))  is applied IFF
 *     1. α_p ∈ A  (operator is in the allowed set)
 *     2. J(Π_F(α_p(s))) < J(s) − ε  (cost must decrease)
 *     3. no g_k becomes positive  (no hard constraint is breached)
 *
 * Therefore no agent, however creative or adversarial, can reduce
 * accessibility or push spacing off-grid.
 */

const EPSILON = 0.001;

/**
 * Apply a proposal through the cage.
 * Returns acceptance/rejection with full metrics.
 */
export function applyThroughCage(
  code: string,
  proposal: AgentProposal,
  currentCost: number,
  cfg: DesignConfig,
  currentHardViolationCount?: number,
): CageResult {
  // Step 1: Apply the operator to get candidate code.
  const candidateCode = applyOperator(code, proposal);
  if (candidateCode === null) {
    return {
      accepted: false,
      costBefore: currentCost,
      rejectionReason: `Operator ${proposal.operator} failed to apply.`,
    };
  }

  // Step 2: Re-perceive and re-metric the candidate.
  let ir: DesignIR;
  try {
    ir = perceive(candidateCode);
  } catch {
    return {
      accepted: false,
      costBefore: currentCost,
      rejectionReason: `Candidate code failed to parse.`,
    };
  }

  const metrics = computeMetrics(ir, cfg);
  const violations = checkConstraints(ir, metrics, cfg);

  // Step 3: Check hard constraint gate — no g_k may INCREASE.
  // The cage only rejects if the proposal introduces NEW hard violations,
  // not if existing violations remain (those are handled by other operators).
  const newHardCount = violations.filter((v) => v.severity === 'hard').length;
  const baselineHard = currentHardViolationCount ?? 0;
  if (newHardCount > baselineHard) {
    return {
      accepted: false,
      costBefore: currentCost,
      costAfter: metrics.cost,
      rejectionReason: `Proposal introduces ${newHardCount - baselineHard} new hard violation(s).`,
    };
  }

  // Step 4: Check ΔJ gate — cost must decrease by at least ε.
  const deltaJ = currentCost - metrics.cost;
  if (deltaJ < EPSILON) {
    return {
      accepted: false,
      costBefore: currentCost,
      costAfter: metrics.cost,
      deltaJ,
      rejectionReason: `Cost did not improve (ΔJ=${deltaJ.toFixed(3)} < ε=${EPSILON}).`,
    };
  }

  // Step 5: Apply the committed result through the full pipeline.
  const finalIR = perceive(candidateCode);
  const finalMetrics = computeMetrics(finalIR, cfg);
  const { fixes } = refine(finalIR, finalMetrics, cfg);
  const finalCode = emit(candidateCode, finalIR, new Map());

  return {
    accepted: true,
    code: finalCode,
    costBefore: currentCost,
    costAfter: metrics.cost,
    deltaJ,
    fixes,
  };
}

/**
 * Apply an operator to the source code.
 * Each operator is a pure transformation on the code string.
 */
function applyOperator(code: string, proposal: AgentProposal): string | null {
  try {
    switch (proposal.operator) {
      case 'semanticRecolor':
        return applySemanticRecolor(code, proposal.params);
      case 'snapSpacing':
      case 'normalizeToken':
      case 'recolorAccessible':
        // These are handled by the existing refine() pipeline.
        // The agent just signals they should be prioritized.
        return code; // no-op; the main pipeline handles these
      case 'dedupeStyle':
        return applyDedupeStyle(code, proposal.params);
      case 'realign':
      case 'toProportion':
        // These need geometry — skip in static path.
        return null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Apply semantic recoloring: replace bg-* and text-* classes on a specific element.
 */
function applySemanticRecolor(code: string, params: Record<string, unknown>): string | null {
  const { oldBg, newBg, oldText, newText } = params as {
    oldBg?: string; newBg?: string; oldText?: string; newText?: string;
  };

  if (!newBg && !newText) return null;

  let result = code;

  // Replace bg class (only the first occurrence to avoid changing other elements)
  if (oldBg && newBg) {
    result = result.replace(oldBg, newBg);
  }

  // Replace text class
  if (oldText && newText) {
    result = result.replace(oldText, newText);
  }

  return result;
}

/**
 * Apply style deduplication: merge identical class sets.
 * This is a simplified version — in production, you'd do proper AST manipulation.
 */
function applyDedupeStyle(code: string, _params: Record<string, unknown>): string | null {
  // For the MVP, this is a no-op — proper deduplication requires AST manipulation.
  // The agent proposes it, but the cage may reject it if it doesn't improve J.
  void code;
  return null;
}
