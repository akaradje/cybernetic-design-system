import type { DesignIR, Metrics, Violation } from './types';
import { DEFAULT_CONFIG, type DesignConfig } from './config/tokens';
import { perceivePixel, parsePixelMap, type PixelGrid, type RGBA } from './layers/pixel-perception';
import { emitPixelPng, enforceSymmetry, snapToPalette } from './layers/pixel-emission';
import { computeMetrics, checkConstraints, refine } from './layers/core';
import { buildReport } from './layers/emission';
import { writeFileSync } from 'node:fs';

/**
 * Pixel-art public API.
 *
 * Usage:
 *   import { analyzePixel, PixelGrid, RGBA } from 'cybernetic-design-system/pixel';
 *
 *   const grid: PixelGrid = [
 *     [{r:255,g:0,b:0,a:255}, {r:0,g:0,b:255,a:255}],
 *     [{r:0,g:0,b:255,a:255}, {r:255,g:0,b:0,a:255}],
 *   ];
 *   const result = analyzePixel(grid);
 *   console.log(result.report);
 */

export interface PixelAnalysisResult {
  ir: DesignIR;
  metrics: Metrics;
  violations: Violation[];
  passed: boolean;
  report: string;
  /** The (possibly corrected) pixel grid. */
  grid: PixelGrid;
  /** PNG buffer of the output. */
  png: Buffer;
}

export interface PixelFixOptions {
  /** Enforce bilateral symmetry. */
  symmetry?: 'vertical' | 'horizontal' | null;
  /** Snap colors to a limited palette. */
  palette?: RGBA[] | null;
}

/**
 * Analyze a pixel grid through the full CDS pipeline.
 */
export function analyzePixel(
  grid: PixelGrid,
  config: Partial<DesignConfig> = {},
  fixOptions: PixelFixOptions = {},
): PixelAnalysisResult {
  const cfg: DesignConfig = { ...DEFAULT_CONFIG, ...config };

  // Apply fixes if requested.
  let workGrid = grid;
  if (fixOptions.symmetry) {
    workGrid = enforceSymmetry(workGrid, fixOptions.symmetry);
  }
  if (fixOptions.palette) {
    workGrid = snapToPalette(workGrid, fixOptions.palette);
  }

  // Layer 1: pixel perception → DesignIR.
  const ir = perceivePixel(workGrid);

  // Layer 2: metrics (using the IR, which now has real geometry).
  const metrics = computeMetrics(ir, cfg);
  const violations = checkConstraints(ir, metrics, cfg);

  // Layer 3: refine (limited for pixel art — no className rewrites).
  const { suggestions } = refine(ir, metrics, cfg);

  // Layer 4: emit PNG.
  const png = emitPixelPng(workGrid);

  const hardViolations = violations.filter((v) => v.severity === 'hard');
  const passed = hardViolations.length === 0;

  const report = buildReport(metrics, violations, [], suggestions, passed);

  return { ir, metrics, violations, passed, report, grid: workGrid, png };
}

/**
 * Save a pixel grid as a PNG file.
 */
export function savePixelPng(grid: PixelGrid, path: string): void {
  const png = emitPixelPng(grid);
  writeFileSync(path, png);
}

export { parsePixelMap, type PixelGrid, type RGBA } from './layers/pixel-perception';
export { enforceSymmetry, snapToPalette } from './layers/pixel-emission';
