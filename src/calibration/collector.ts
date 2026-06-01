import type { MetricVector, Rating } from './types';
import type { DesignConfig } from '../config/tokens';
import { perceive } from '../layers/perception';
import { computeMetrics } from '../layers/core';
import { DEFAULT_CONFIG } from '../config/tokens';

/**
 * M6 — Metric vector collector.
 *
 * For each rated screen, compute the full metric vector (all features
 * normalized to [0,1]). These vectors are the independent variables
 * in the regression; the human ratings are the dependent variable.
 */

/**
 * Compute a metric vector for a single screen.
 * Extracts all measurable features and normalizes to [0,1].
 */
export function computeMetricVector(
  code: string,
  screenId: string,
  humanScore: number,
  cfg: DesignConfig = DEFAULT_CONFIG,
): MetricVector {
  const ir = perceive(code);
  const metrics = computeMetrics(ir, cfg);

  const features: Record<string, number> = {};

  // Ngo 14 measures (already 0..1)
  features.balance = metrics.ngo14.balance;
  features.equilibrium = metrics.ngo14.equilibrium;
  features.symmetry = metrics.ngo14.symmetry;
  features.sequence = metrics.ngo14.sequence;
  features.cohesion = metrics.ngo14.cohesion;
  features.unity = metrics.ngo14.unity;
  features.proportion = metrics.ngo14.proportion;
  features.simplicity = metrics.ngo14.simplicity;
  features.density = metrics.ngo14.density;
  features.regularity = metrics.ngo14.regularity;
  features.economy = metrics.ngo14.economy;
  features.homogeneity = metrics.ngo14.homogeneity;
  features.rhythm = metrics.ngo14.rhythm;

  // Birkhoff measure (0..1)
  features.birkhoff = metrics.birkhoff.measure;

  // Contrast: fraction passing WCAG (0..1)
  const total = metrics.contrast.length || 1;
  const passing = metrics.contrast.filter((c) => c.ratio >= cfg.minContrast).length;
  features.contrast = passing / total;

  // Grid adherence (0..1)
  features.grid = metrics.gridAdherence;

  // Hick index: normalize by maxInteractiveChoices (0..1, lower = better)
  features.hick = 1 - Math.min(1, metrics.density.interactiveCount / cfg.maxInteractiveChoices);

  // Image metrics (if available)
  if (metrics.image) {
    features.colorfulness = metrics.image.colorfulnessScore;
    features.clutter = metrics.image.clutterScore;
  }

  return { screenId, features, humanScore };
}

/**
 * Compute metric vectors for a batch of ratings.
 */
export function collectMetricVectors(
  ratings: Rating[],
  cfg: DesignConfig = DEFAULT_CONFIG,
): MetricVector[] {
  return ratings.map((r) => computeMetricVector(r.code, r.screenId, r.score, cfg));
}
