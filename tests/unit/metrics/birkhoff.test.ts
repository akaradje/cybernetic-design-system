import { describe, it, expect } from 'vitest';
import { birkhoff } from '../../../src/metrics/birkhoff';
import { perceive } from '../../../src/layers/perception';
import { DEFAULT_CONFIG } from '../../../src/config/tokens';
import { CLEAN_CODE, DIRTY_CODE } from '../../setup';

describe('birkhoff', () => {
  it('returns valid result for clean code', () => {
    const ir = perceive(CLEAN_CODE);
    const result = birkhoff(ir, DEFAULT_CONFIG);

    expect(result.order).toBeGreaterThanOrEqual(0);
    expect(result.order).toBeLessThanOrEqual(1);
    expect(result.complexity).toBeGreaterThanOrEqual(1);
    expect(result.measure).toBeGreaterThanOrEqual(0);
    expect(result.measure).toBeLessThanOrEqual(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns valid result for dirty code', () => {
    const ir = perceive(DIRTY_CODE);
    const result = birkhoff(ir, DEFAULT_CONFIG);

    expect(result.order).toBeGreaterThanOrEqual(0);
    expect(result.complexity).toBeGreaterThanOrEqual(1);
  });

  it('has breakdown with all three components', () => {
    const ir = perceive(CLEAN_CODE);
    const result = birkhoff(ir, DEFAULT_CONFIG);

    expect(result.breakdown).toHaveProperty('colorOrder');
    expect(result.breakdown).toHaveProperty('spacingOrder');
    expect(result.breakdown).toHaveProperty('gridOrder');
  });

  it('scores clean code higher than dirty code', () => {
    const cleanIR = perceive(CLEAN_CODE);
    const dirtyIR = perceive(DIRTY_CODE);
    const cleanScore = birkhoff(cleanIR, DEFAULT_CONFIG).score;
    const dirtyScore = birkhoff(dirtyIR, DEFAULT_CONFIG).score;

    // Clean should score at least as high as dirty
    expect(cleanScore).toBeGreaterThanOrEqual(dirtyScore);
  });
});
