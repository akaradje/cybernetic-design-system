import type { DesignIR, Metrics, AppliedFix } from '../types';
import type { DesignConfig } from '../config/tokens';

/**
 * M4 — Agent types for the bounded agent system.
 *
 * Agents are optional proposers that sit behind the cage. Every proposal
 * is validated by Π_F (projection onto feasible set) and ΔJ<0 (cost must
 * decrease) before being committed. No agent can breach hard constraints.
 *
 * The MVP uses deterministic heuristics. LLM integration is opt-in —
 * the same validation pipeline applies regardless of proposal source.
 */

/** The set of operators an agent can invoke. */
export type OperatorId =
  | 'snapSpacing'
  | 'normalizeToken'
  | 'recolorAccessible'
  | 'semanticRecolor'
  | 'realign'
  | 'toProportion'
  | 'dedupeStyle';

/** A proposal from an agent — an operator + its parameters. */
export interface AgentProposal {
  /** Which operator to invoke. */
  operator: OperatorId;
  /** Human-readable reason for this proposal. */
  reason: string;
  /** Operator-specific parameters. */
  params: Record<string, unknown>;
}

/** Result of applying a proposal through the cage. */
export interface CageResult {
  /** Whether the proposal was accepted (passed Π_F + ΔJ<0). */
  accepted: boolean;
  /** The code after applying the proposal (only if accepted). */
  code?: string;
  /** The cost after applying the proposal. */
  costAfter?: number;
  /** The cost before the proposal. */
  costBefore: number;
  /** ΔJ = costBefore - costAfter (positive = improvement). */
  deltaJ?: number;
  /** Rejection reason if not accepted. */
  rejectionReason?: string;
  /** Fixes applied (if accepted). */
  fixes?: AppliedFix[];
}

/** An agent that proposes edits to the design. */
export interface Agent {
  /** Unique agent identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Propose a set of candidate edits given the current IR state. */
  propose(ir: DesignIR, code: string, metrics?: Metrics, cfg?: DesignConfig): AgentProposal[];
}
