import type { AnalysisResult, DesignState } from './types';
import { DEFAULT_CONFIG, DesignConfig } from './config/tokens';
import { perceive, irToState } from './layers/perception';
import { computeMetrics, checkConstraints, refine } from './layers/core';
import { emit, buildReport } from './layers/emission';
import type { PixelData } from './metrics/image';
import { cbir, type CBIRResult } from './refiners/cbir';
import { perceiveDynamic, type DynamicOptions } from './layers/dynamic-perception';
import { orchestrate, type OrchestratorResult } from './agents/orchestrator';
import type { Agent } from './agents/types';

export * from './types';
export { DEFAULT_CONFIG } from './config/tokens';
export type { DesignConfig } from './config/tokens';
export type { PixelData } from './metrics/image';
export { CONSTRAINT_CATALOG, getConstraintMeta } from './constraints/catalog';
export type { ConstraintDef } from './constraints/catalog';
export { toMetricVector, paretoFront, dominates, rankByCost, formatParetoReport } from './constraints/pareto';
export type { MetricVector } from './constraints/pareto';
export { cbir } from './refiners/cbir';
export type { CBIRResult } from './refiners/cbir';
export { perceiveDynamic } from './layers/dynamic-perception';
export type { DynamicOptions } from './layers/dynamic-perception';
export { orchestrate } from './agents/orchestrator';
export type { OrchestratorResult } from './agents/orchestrator';
export { createSemanticAgent } from './agents/semantic';
export { createAestheticAgent } from './agents/aesthetic';
export type { Agent, AgentProposal, CageResult } from './agents/types';

/**
 * Run the full pipeline on a piece of UI source.
 * Perception -> Metric Bank (metrics + constraints) -> bounded refine -> emission.
 *
 * @param code - JSX/TSX source code to analyze
 * @param config - optional design config overrides
 * @param pixels - optional rendered screenshot for image-statistic metrics (M2.2)
 */
export function analyze(code: string, config: Partial<DesignConfig> = {}, pixels?: PixelData | null): AnalysisResult {
  const cfg: DesignConfig = { ...DEFAULT_CONFIG, ...config };

  const ir = perceive(code);                          // Layer 1 — DesignIR
  const metrics = computeMetrics(ir, cfg, pixels);    // Layer 2
  const violations = checkConstraints(ir, metrics, cfg);
  const { fixes, edits, suggestions } = refine(ir, metrics, cfg); // Layer 3
  const fixedCode = emit(code, ir, edits);            // Layer 4

  // A "pass" = no hard violations remain after fixes. Grid violations are
  // auto-fixed, so re-derive the residual set those fixes didn't cover.
  const fixedClasses = new Set(fixes.map((f) => f.before));
  const residualHard = violations.filter(
    (v) => v.severity === 'hard' && !(v.rule === 'grid.spacing' && [...fixedClasses].some((c) => v.message.startsWith(c))),
  );
  const passed = residualHard.length === 0;

  const report = buildReport(metrics, violations, fixes, suggestions, passed);

  // Derive legacy DesignState for backward compatibility.
  const state: DesignState = irToState(ir);

  return { ir, state, metrics, violations, fixes, fixedCode, passed, report };
}

/** Convenience: return the corrected source plus the full result. */
export function fix(code: string, config: Partial<DesignConfig> = {}, pixels?: PixelData | null): { code: string; result: AnalysisResult } {
  const result = analyze(code, config, pixels);
  return { code: result.fixedCode, result };
}

/**
 * Run the full pipeline with dynamic perception (Playwright).
 * Renders the component in headless Chromium, reads computed bounding boxes,
 * captures a screenshot for image metrics, then runs the full analysis.
 *
 * @param code - JSX/TSX source code to analyze
 * @param config - optional design config overrides
 * @param options - Playwright rendering options
 */
export async function analyzeDynamic(
  code: string,
  config: Partial<DesignConfig> = {},
  options: DynamicOptions = {},
): Promise<AnalysisResult> {
  const cfg: DesignConfig = { ...DEFAULT_CONFIG, ...config };

  // Layer 1a: static perception (AST → IR).
  const staticIR = perceive(code);

  // Layer 1b: dynamic perception (render → boxes + screenshot).
  const { ir, pixels } = await perceiveDynamic(code, staticIR, options);

  // Layer 2: metrics (now with real geometry).
  const metrics = computeMetrics(ir, cfg, pixels);
  const violations = checkConstraints(ir, metrics, cfg);
  const { fixes, edits, suggestions } = refine(ir, metrics, cfg);
  const fixedCode = emit(code, ir, edits);

  const fixedClasses = new Set(fixes.map((f) => f.before));
  const residualHard = violations.filter(
    (v) => v.severity === 'hard' && !(v.rule === 'grid.spacing' && [...fixedClasses].some((c) => v.message.startsWith(c))),
  );
  const passed = residualHard.length === 0;

  const report = buildReport(metrics, violations, fixes, suggestions, passed);
  const state: DesignState = irToState(ir);

  return { ir, state, metrics, violations, fixes, fixedCode, passed, report };
}
