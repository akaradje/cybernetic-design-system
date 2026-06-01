import type { Agent, AgentProposal, OperatorId } from './types';
import type { DesignIR, Metrics } from '../types';
import type { DesignConfig } from '../config/tokens';

/**
 * Aesthetic Agent — proposes which operators to try and in what order.
 *
 * This agent analyzes the current metric vector and proposes a sequence
 * of operators that are likely to improve J. It's a search heuristic,
 * not a solver — it proposes candidates, and the cage picks the best one.
 *
 * The agent cannot invent operators outside A. It can only suggest
 * ordering and targeting of the existing operator set.
 */

/** Score each operator's potential based on current metric state. */
function scoreOperatorPotential(
  op: OperatorId,
  ir: DesignIR,
  metrics: Metrics,
  cfg: DesignConfig,
): number {
  let score = 0;

  switch (op) {
    case 'snapSpacing': {
      // High potential if many spacing values are off-grid
      const offGrid = ir.tokens.spacing.filter((s) => !s.onGrid).length;
      score = offGrid * 3;
      break;
    }
    case 'normalizeToken': {
      // High potential if many arbitrary values (p-[13px] etc.)
      const arbitrary = ir.tokens.spacing.filter((s) => s.classToken.includes('[')).length;
      score = arbitrary * 2;
      break;
    }
    case 'recolorAccessible': {
      // High potential if WCAG contrast fails
      const failing = metrics.contrast.filter((c) => c.ratio < cfg.minContrast).length;
      score = failing * 4;
      break;
    }
    case 'semanticRecolor': {
      // Medium potential if interactive elements don't match semantic intent
      const interactive = ir.nodes.filter((n) => n.interactive).length;
      score = interactive * 1.5;
      break;
    }
    case 'dedupeStyle': {
      // Medium potential if many distinct class sets
      const distinctSets = new Set(ir.nodes.map((n) => n.classes.join(' '))).size;
      const ratio = distinctSets / (ir.nodes.length || 1);
      score = ratio > 0.8 ? (ratio - 0.5) * 10 : 0;
      break;
    }
    case 'realign': {
      // Low potential in static path (needs geometry)
      score = ir.meta.rendered ? 2 : 0;
      break;
    }
    case 'toProportion': {
      // Low potential in static path (needs geometry)
      score = ir.meta.rendered ? 1.5 : 0;
      break;
    }
  }

  return score;
}

/**
 * Create an Aesthetic Agent that proposes operator ordering based on metrics.
 */
export function createAestheticAgent(): Agent {
  return {
    id: 'aesthetic',
    name: 'Aesthetic Agent',
    propose(ir: DesignIR, _code: string, metrics?: Metrics, cfg?: DesignConfig): AgentProposal[] {
      const proposals: AgentProposal[] = [];

      if (!metrics || !cfg) return proposals;

      // All available operators
      const operators: OperatorId[] = [
        'snapSpacing', 'normalizeToken', 'recolorAccessible',
        'semanticRecolor', 'dedupeStyle', 'realign', 'toProportion',
      ];

      // Score each operator's potential
      const scored = operators
        .map((op) => ({
          op,
          score: scoreOperatorPotential(op, ir, metrics, cfg),
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      // Propose the top operators in priority order
      for (const { op, score } of scored.slice(0, 3)) {
        proposals.push({
          operator: op,
          reason: `Aesthetic heuristic: ${op} (potential score ${score.toFixed(1)})`,
          params: { priority: score },
        });
      }

      return proposals;
    },
  };
}
