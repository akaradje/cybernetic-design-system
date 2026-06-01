import type { DesignIR, AppliedFix, Metrics, Violation } from '../types';
import type { DesignConfig } from '../config/tokens';
import { computeMetrics, checkConstraints, refine } from '../layers/core';
import { emit } from '../layers/emission';

/**
 * M4 — Constraint-Bounded Iterative Refinement (CBIR) loop.
 *
 * The "receding-horizon" optimization from ARCHITECTURE.md §2.2:
 *
 *   s ← Π_F(s₀)                       # start feasible
 *   repeat:
 *       candidates ← propose(s, A)    # deterministic refiners
 *       for each candidate edit α:
 *           s' ← Π_F(α(s))            # apply, then project onto feasible set
 *           score s' by J             # "predict" outcome via metrics
 *       α* ← argmin_α J(Π_F(α(s)))    # pick the best single move this step
 *       if J improved by > ε: s ← Π_F(α*(s))   # apply one move, re-measure
 *       else: break                   # converged
 *   return s
 *
 * The cage guarantee: no agent can breach hard constraints or increase J.
 */

export interface CBIRResult {
  /** The optimized code. */
  code: string;
  /** All fixes applied across all iterations. */
  fixes: AppliedFix[];
  /** Number of iterations until convergence. */
  iterations: number;
  /** Final cost J. */
  finalCost: number;
  /** Cost improvement ΔJ = J_initial - J_final. */
  improvement: number;
  /** Final violations. */
  violations: Violation[];
  /** Suggestions from contrast analysis. */
  suggestions: string[];
  /** Whether the final state passes all hard constraints. */
  passed: boolean;
  /** The final IR. */
  ir: DesignIR;
  /** The final metrics. */
  metrics: Metrics;
}

const EPSILON = 0.001; // minimum J improvement to continue
const MAX_ITERATIONS = 10; // hard cap to prevent infinite loops

/**
 * Run the CBIR loop on a piece of UI source code.
 * Each iteration applies the best single move that improves J while
 * respecting all hard constraints.
 */
export function cbir(
  code: string,
  config: DesignConfig,
  maxIter: number = MAX_ITERATIONS,
): CBIRResult {
  const allFixes: AppliedFix[] = [];
  let currentCode = code;
  let prevCost = Infinity;

  // Initial pass to get baseline cost.
  const initialResult = refine_pass(currentCode, config);
  prevCost = initialResult.metrics.cost;

  let iterations = 0;
  let lastResult = initialResult;

  for (let i = 0; i < maxIter; i++) {
    iterations = i + 1;

    // Propose candidates: run the deterministic refiners.
    const candidate = refine_pass(currentCode, config);

    // Check convergence: J must improve by at least EPSILON.
    const deltaJ = prevCost - candidate.metrics.cost;
    if (deltaJ < EPSILON) {
      // No meaningful improvement — converged.
      lastResult = candidate;
      break;
    }

    // Apply the best move.
    currentCode = candidate.fixedCode;
    allFixes.push(...candidate.fixes);
    prevCost = candidate.metrics.cost;
    lastResult = candidate;

    // If no violations remain, we're done.
    if (candidate.violations.filter((v) => v.severity === 'hard').length === 0) {
      break;
    }
  }

  return {
    code: currentCode,
    fixes: allFixes,
    iterations,
    finalCost: lastResult.metrics.cost,
    improvement: initialResult.metrics.cost - lastResult.metrics.cost,
    violations: lastResult.violations,
    suggestions: lastResult.suggestions,
    passed: lastResult.passed,
    ir: lastResult.ir,
    metrics: lastResult.metrics,
  };
}

/**
 * Single refinement pass: perceive → metrics → constraints → refine → emit.
 * This is the "forward model" that scores a candidate state.
 */
function refine_pass(code: string, cfg: DesignConfig) {
  const ir = perceive_safe(code);
  if (!ir) {
    return {
      ir: null as any,
      metrics: { contrast: [], apca: [], birkhoff: { order: 0, complexity: 1, measure: 0, score: 0, breakdown: {} }, ngo14: {} as any, image: null, density: { interactiveCount: 0, hickIndex: 0, elementCount: 0, nestingDepth: 0, warnings: [] }, gridAdherence: 1, cost: 999 },
      violations: [],
      fixes: [],
      edits: new Map<string, string>(),
      suggestions: [],
      fixedCode: code,
      passed: false,
    };
  }

  const metrics = computeMetrics(ir, cfg);
  const violations = checkConstraints(ir, metrics, cfg);
  const { fixes, edits, suggestions } = refine(ir, metrics, cfg);
  const fixedCode = emit(code, ir, edits);

  const fixedClasses = new Set(fixes.map((f) => f.before));
  const residualHard = violations.filter(
    (v) => v.severity === 'hard' && !(v.rule === 'grid.spacing' && [...fixedClasses].some((c) => v.message.startsWith(c))),
  );
  const passed = residualHard.length === 0;

  return { ir, metrics, violations, fixes, edits, suggestions, fixedCode, passed };
}

/** Safe perception: returns null if parsing fails. */
function perceive_safe(code: string): DesignIR | null {
  try {
    const { perceive } = require('../layers/perception');
    return perceive(code);
  } catch {
    return null;
  }
}
