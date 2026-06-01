import type { Rating, CalibratedWeights, MetricVector } from './types';
import { DEFAULT_WEIGHTS } from './types';
import { collectMetricVectors } from './collector';
import { fitRidge, fitOLS } from './fitter';
import type { DesignConfig } from '../config/tokens';
import { DEFAULT_CONFIG } from '../config/tokens';

/**
 * M6 — Calibration harness public API.
 *
 * Usage:
 *   import { calibrate, Rating } from 'cybernetic-design-system/calibration';
 *
 *   const ratings: Rating[] = [
 *     { screenId: 'a', code: '...', score: 5.2, method: 'likert' },
 *     { screenId: 'b', code: '...', score: 3.8, method: 'likert' },
 *     // ...
 *   ];
 *   const result = calibrate(ratings);
 *   console.log(result.weights);  // calibrated weight set
 *   console.log(result.r2);       // model fit quality
 */

export { type Rating, type CalibratedWeights, type MetricVector, DEFAULT_WEIGHTS } from './types';
export { collectMetricVectors } from './collector';
export { fitRidge, fitOLS } from './fitter';

export interface CalibrateResult {
  /** The calibrated weights. */
  calibrated: CalibratedWeights;
  /** The metric vectors used for fitting. */
  vectors: MetricVector[];
  /** Comparison with default weights. */
  comparison: {
    default: Record<string, number>;
    calibrated: Record<string, number>;
    delta: Record<string, number>;
  };
}

/**
 * Run the full calibration pipeline.
 *
 * 1. Compute metric vectors for each rated screen.
 * 2. Fit weights via ridge regression.
 * 3. Compare with default weights.
 */
export function calibrate(
  ratings: Rating[],
  config: Partial<DesignConfig> = {},
  lambda: number = 0.1,
): CalibrateResult {
  const cfg: DesignConfig = { ...DEFAULT_CONFIG, ...config };

  // Step 1: Compute metric vectors.
  const vectors = collectMetricVectors(ratings, cfg);

  // Step 2: Fit weights.
  const calibrated = fitRidge(vectors, lambda);

  // Step 3: Compare with defaults.
  const allKeys = new Set([
    ...Object.keys(DEFAULT_WEIGHTS),
    ...Object.keys(calibrated.weights),
  ]);

  const delta: Record<string, number> = {};
  for (const key of allKeys) {
    const def = DEFAULT_WEIGHTS[key] ?? 0;
    const cal = calibrated.weights[key] ?? 0;
    delta[key] = Math.round((cal - def) * 1000) / 1000;
  }

  return {
    calibrated,
    vectors,
    comparison: {
      default: DEFAULT_WEIGHTS,
      calibrated: calibrated.weights,
      delta,
    },
  };
}

/**
 * Generate a calibration report.
 */
export function buildCalibrationReport(result: CalibrateResult): string {
  const L: string[] = [];
  const { calibrated, comparison } = result;

  L.push('Calibration Harness — report');
  L.push(`method: ${calibrated.method}   samples: ${calibrated.sampleCount}`);
  L.push(`fit: R²=${calibrated.r2}   MAE=${calibrated.mae}`);
  L.push('');

  L.push('calibrated weights:');
  const sortedKeys = Object.keys(comparison.calibrated)
    .sort((a, b) => Math.abs(comparison.calibrated[b]) - Math.abs(comparison.calibrated[a]));

  for (const key of sortedKeys) {
    const def = comparison.default[key] ?? 0;
    const cal = comparison.calibrated[key] ?? 0;
    const d = comparison.delta[key] ?? 0;
    const arrow = d > 0.01 ? '↑' : d < -0.01 ? '↓' : '=';
    L.push(`  ${key.padEnd(15)} ${cal.toFixed(3).padStart(7)}  (default ${def.toFixed(3).padStart(7)}  Δ${d >= 0 ? '+' : ''}${d.toFixed(3).padStart(7)} ${arrow})`);
  }

  L.push('');
  if (calibrated.r2 < 0.3) {
    L.push('⚠ Low R² — the model does not explain human ratings well.');
    L.push('  Consider collecting more samples or adding features.');
  } else if (calibrated.r2 < 0.6) {
    L.push('◐ Moderate R² — the model captures some variance in human ratings.');
  } else {
    L.push('✓ Good R² — the model explains human ratings well.');
  }

  return L.join('\n');
}
