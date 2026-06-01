import type { Agent, AgentProposal, CageResult } from './types';
import type { DesignIR, Metrics, AppliedFix } from '../types';
import type { DesignConfig } from '../config/tokens';
import { createSemanticAgent } from './semantic';
import { createAestheticAgent } from './aesthetic';
import { applyThroughCage } from './cage';
import { perceive } from '../layers/perception';
import { computeMetrics, checkConstraints, refine } from '../layers/core';
import { emit } from '../layers/emission';

/**
 * Agent Orchestrator — runs all agents, applies proposals through the cage,
 * picks the best accepted proposal each round.
 *
 * This is the "propose → validate → commit" loop from M4.
 */

export interface OrchestratorResult {
  /** The optimized code. */
  code: string;
  /** All proposals made by agents. */
  proposals: AgentProposal[];
  /** All cage results (accepted and rejected). */
  cageResults: CageResult[];
  /** All fixes applied. */
  fixes: AppliedFix[];
  /** Number of accepted proposals. */
  acceptedCount: number;
  /** Number of rejected proposals. */
  rejectedCount: number;
  /** Final cost J. */
  finalCost: number;
  /** Total cost improvement. */
  improvement: number;
}

/** Default set of agents. */
const DEFAULT_AGENTS: Agent[] = [
  createSemanticAgent(),
  createAestheticAgent(),
];

/**
 * Run one round of agent proposals through the cage.
 * Returns the best accepted proposal (largest ΔJ), or null if none accepted.
 */
export function runAgentRound(
  code: string,
  ir: DesignIR,
  metrics: Metrics,
  cfg: DesignConfig,
  agents: Agent[] = DEFAULT_AGENTS,
): { result: CageResult; proposal: AgentProposal } | null {
  // Collect proposals from all agents.
  const allProposals: AgentProposal[] = [];
  for (const agent of agents) {
    const proposals = agent.propose(ir, code, metrics, cfg);
    allProposals.push(...proposals);
  }

  if (allProposals.length === 0) return null;

  // Apply each proposal through the cage.
  const currentCost = metrics.cost;
  const currentHardCount = checkConstraints(ir, metrics, cfg).filter((v) => v.severity === 'hard').length;
  let best: { result: CageResult; proposal: AgentProposal } | null = null;

  for (const proposal of allProposals) {
    const cageResult = applyThroughCage(code, proposal, currentCost, cfg, currentHardCount);

    if (cageResult.accepted) {
      // Pick the proposal with the largest ΔJ.
      if (!best || (cageResult.deltaJ ?? 0) > (best.result.deltaJ ?? 0)) {
        best = { result: cageResult, proposal };
      }
    }
  }

  return best;
}

/**
 * Run the full agent orchestration loop.
 * Iterates: agents propose → cage validates → best proposal committed → repeat.
 * Converges when no agent proposal improves J.
 */
export function orchestrate(
  code: string,
  cfg: DesignConfig,
  agents: Agent[] = DEFAULT_AGENTS,
  maxRounds: number = 5,
): OrchestratorResult {
  const allProposals: AgentProposal[] = [];
  const allCageResults: CageResult[] = [];
  const allFixes: AppliedFix[] = [];
  let currentCode = code;
  let acceptedCount = 0;
  let rejectedCount = 0;

  // Get initial cost.
  let ir = perceive(currentCode);
  let metrics = computeMetrics(ir, cfg);
  const initialCost = metrics.cost;

  for (let round = 0; round < maxRounds; round++) {
    // Run one round of agent proposals.
    const best = runAgentRound(currentCode, ir, metrics, cfg, agents);

    if (!best) {
      // No agent proposed anything useful — converged.
      break;
    }

    // Record the proposal and cage result.
    allProposals.push(best.proposal);
    allCageResults.push(best.result);

    if (best.result.accepted) {
      acceptedCount++;
      currentCode = best.result.code!;
      if (best.result.fixes) allFixes.push(...best.result.fixes);

      // Re-perceive and re-metric for the next round.
      ir = perceive(currentCode);
      metrics = computeMetrics(ir, cfg);
    } else {
      rejectedCount++;
    }
  }

  return {
    code: currentCode,
    proposals: allProposals,
    cageResults: allCageResults,
    fixes: allFixes,
    acceptedCount,
    rejectedCount,
    finalCost: metrics.cost,
    improvement: initialCost - metrics.cost,
  };
}
