/**
 * M6 — Calibration types.
 *
 * The equal-weight assumption is the weakest link (§1.3). The calibration
 * harness closes the loop: collect human ratings → re-fit weights → ship
 * calibrated defaults.
 */

/** A single human rating of a design screen. */
export interface Rating {
  /** Identifier for the screen being rated. */
  screenId: string;
  /** The source code of the screen. */
  code: string;
  /** Human aesthetic rating (1-7 Likert scale, or normalized 0-1). */
  score: number;
  /** Rating method. */
  method: 'likert' | 'pairwise' | 'ranking';
  /** Optional metadata (locale, brand, rater ID). */
  meta?: Record<string, string>;
}

/** A metric vector for a single screen — the features used for regression. */
export interface MetricVector {
  screenId: string;
  /** All metric values normalized to [0,1]. */
  features: Record<string, number>;
  /** The human rating for this screen. */
  humanScore: number;
}

/** The calibrated weight set. */
export interface CalibratedWeights {
  /** The metric name → weight mapping. */
  weights: Record<string, number>;
  /** R² of the fit (how well the model predicts human ratings). */
  r2: number;
  /** Mean absolute error of the predictions. */
  mae: number;
  /** Number of samples used for calibration. */
  sampleCount: number;
  /** The calibration method used. */
  method: 'ridge' | 'ols';
  /** Timestamp of calibration. */
  timestamp: string;
}

/** The default metric weights (evidence-based from §1.6). */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  // High-weight measures (evidence: replicated as most influential)
  symmetry: 2.0,
  cohesion: 2.0,
  balance: 1.5,
  equilibrium: 1.5,
  sequence: 1.5,
  unity: 1.5,
  // Low-weight measures (evidence: weak–moderate)
  proportion: 0.5,
  simplicity: 0.5,
  density: 0.5,
  regularity: 0.5,
  economy: 0.3,
  homogeneity: 0.3,
  rhythm: 0.3,
  // Non-Ngo metrics
  contrast: 3.0,
  grid: 5.0,
  hick: 2.0,
  birkhoff: 4.0,
};
