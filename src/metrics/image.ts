import type { ImageMetricsResult } from '../types';

/**
 * M2.2 — Image-statistic metrics (need a rendered screenshot).
 *
 * These operate on raw pixel data (RGBA, row-major). In the static path
 * (no render), they return null — the pipeline skips them gracefully.
 *
 * References:
 *   - Hasler & Süsstrunk (2003) — colorfulness
 *   - Rosenholtz et al. (2005, 2007) — Feature Congestion clutter
 */

export interface PixelData {
  /** Flat RGBA array, row-major. Length = width * height * 4. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Target colorfulness band (from Reinecke et al. 2013 data). */
const CF_BAND: [number, number] = [20, 80]; // too low = drab, too high = garish
const CLUTTER_BAND: [number, number] = [0.2, 0.6]; // moderate complexity = best

/**
 * Hasler & Süsstrunk (2003) colorfulness metric.
 * CF = √(σ²_rg + σ²_yb) + 0.3·√(μ²_rg + μ²_yb)
 */
export function colorfulness(pixels: PixelData): number {
  const { data, width, height } = pixels;
  const n = width * height;
  if (n === 0) return 0;

  let sumRg = 0, sumYb = 0;
  let sumRg2 = 0, sumYb2 = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    sumRg += rg;
    sumYb += yb;
    sumRg2 += rg * rg;
    sumYb2 += yb * yb;
  }

  const meanRg = sumRg / n;
  const meanYb = sumYb / n;
  const varRg = sumRg2 / n - meanRg * meanRg;
  const varYb = sumYb2 / n - meanYb * meanYb;

  return Math.sqrt(varRg + varYb) + 0.3 * Math.sqrt(meanRg * meanRg + meanYb * meanYb);
}

/**
 * Rosenholtz Feature Congestion — simplified version.
 * Measures local variability in color and luminance.
 * Returns a scalar in [0,1] where moderate values (~0.3-0.5) are best.
 */
export function featureCongestion(pixels: PixelData): number {
  const { data, width, height } = pixels;
  if (width < 3 || height < 3) return 0;

  // Compute local variability using a 3×3 sliding window.
  // For efficiency, we sample every 4th pixel.
  const step = 4;
  let totalVariability = 0;
  let sampleCount = 0;

  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const centerIdx = (y * width + x) * 4;
      const centerLum = luminance(data[centerIdx], data[centerIdx + 1], data[centerIdx + 2]);

      let neighborVar = 0;
      let count = 0;

      // 3×3 neighborhood
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * width + (x + dx)) * 4;
          const nLum = luminance(data[ni], data[ni + 1], data[ni + 2]);
          neighborVar += Math.abs(centerLum - nLum);
          count++;
        }
      }

      totalVariability += neighborVar / count;
      sampleCount++;
    }
  }

  if (sampleCount === 0) return 0;

  // Normalize: max possible luminance difference is 255
  const avgVariability = totalVariability / sampleCount / 255;
  return Math.min(1, avgVariability * 3); // scale to useful range
}

/**
 * Compute both image metrics from pixel data.
 * Returns null if no pixel data is available (static path).
 */
export function computeImageMetrics(pixels: PixelData | null): ImageMetricsResult | null {
  if (!pixels) return null;

  const cf = colorfulness(pixels);
  const clutter = featureCongestion(pixels);

  // Map to quality scores (0..1): moderate values are best.
  const cfScore = bandScore(cf, CF_BAND[0], CF_BAND[1]);
  const clutterScore = bandScore(clutter, CLUTTER_BAND[0], CLUTTER_BAND[1]);

  return {
    colorfulness: round(cf),
    clutter: round(clutter),
    colorfulnessScore: round(cfScore),
    clutterScore: round(clutterScore),
  };
}

/** Score: 1 inside the sweet band, decaying outside. */
function bandScore(value: number, low: number, high: number): number {
  if (value >= low && value <= high) return 1;
  if (value < low) return Math.max(0, value / low);
  return Math.max(0, 1 - (value - high) / (1 - high));
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
