import { describe, it, expect } from 'vitest';
import { ngo14 } from '../../../src/metrics/ngo';
import { perceive } from '../../../src/layers/perception';
import { DEFAULT_CONFIG } from '../../../src/config/tokens';
import { CLEAN_CODE, DIRTY_CODE } from '../../setup';

describe('ngo14', () => {
  it('returns all 13 measures + order', () => {
    const ir = perceive(CLEAN_CODE);
    const result = ngo14(ir, DEFAULT_CONFIG);

    const expectedKeys = [
      'balance', 'equilibrium', 'symmetry', 'sequence', 'cohesion', 'unity',
      'proportion', 'simplicity', 'density', 'regularity', 'economy',
      'homogeneity', 'rhythm', 'order',
    ];
    for (const key of expectedKeys) {
      expect(result).toHaveProperty(key);
      expect(typeof (result as any)[key]).toBe('number');
    }
  });

  it('all measures are in [0,1]', () => {
    const ir = perceive(DIRTY_CODE);
    const result = ngo14(ir, DEFAULT_CONFIG);

    for (const key of Object.keys(result)) {
      const val = (result as any)[key];
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it('returns 1 for empty IR', () => {
    const emptyIR = {
      frame: { w: 0, h: 0 },
      nodes: [],
      tokens: { colors: [], spacing: [] },
      source: { classSites: [] },
      meta: { dpr: 1, colorSpace: 'srgb' as const, rendered: false },
    };
    const result = ngo14(emptyIR, DEFAULT_CONFIG);
    expect(result.order).toBe(1);
  });
});
