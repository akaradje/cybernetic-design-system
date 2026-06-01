import { describe, it, expect } from 'vitest';
import { colorfulness, featureCongestion, computeImageMetrics } from '../../../src/metrics/image';

describe('image', () => {
  describe('colorfulness', () => {
    it('returns 0 for uniform color', () => {
      const pixels = {
        data: new Uint8ClampedArray([128, 128, 128, 255, 128, 128, 128, 255]),
        width: 2,
        height: 1,
      };
      expect(colorfulness(pixels)).toBe(0);
    });

    it('returns > 0 for varied colors', () => {
      const pixels = {
        data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
        width: 3,
        height: 1,
      };
      expect(colorfulness(pixels)).toBeGreaterThan(0);
    });
  });

  describe('featureCongestion', () => {
    it('returns 0 for very small images', () => {
      const pixels = {
        data: new Uint8ClampedArray([255, 0, 0, 255]),
        width: 1,
        height: 1,
      };
      expect(featureCongestion(pixels)).toBe(0);
    });

    it('returns a value for larger images', () => {
      // 4x4 red image
      const data = new Uint8ClampedArray(4 * 4 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
      }
      const pixels = { data, width: 4, height: 4 };
      expect(featureCongestion(pixels)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeImageMetrics', () => {
    it('returns null for null input', () => {
      expect(computeImageMetrics(null)).toBeNull();
    });

    it('returns valid result for pixel data', () => {
      const data = new Uint8ClampedArray(4 * 4 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
      }
      const pixels = { data, width: 4, height: 4 };
      const result = computeImageMetrics(pixels);
      expect(result).toBeTruthy();
      expect(result!.colorfulness).toBeGreaterThanOrEqual(0);
      expect(result!.clutter).toBeGreaterThanOrEqual(0);
      expect(result!.colorfulnessScore).toBeGreaterThanOrEqual(0);
      expect(result!.clutterScore).toBeGreaterThanOrEqual(0);
    });
  });
});
