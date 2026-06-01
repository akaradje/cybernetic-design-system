import { describe, it, expect } from 'vitest';
import { density } from '../../../src/metrics/density';
import { perceive } from '../../../src/layers/perception';
import { DEFAULT_CONFIG } from '../../../src/config/tokens';
import { CLEAN_CODE, DIRTY_CODE } from '../../setup';

describe('density', () => {
  it('returns valid result for clean code', () => {
    const ir = perceive(CLEAN_CODE);
    const result = density(ir, DEFAULT_CONFIG);

    expect(result.interactiveCount).toBeGreaterThanOrEqual(0);
    expect(result.hickIndex).toBeGreaterThanOrEqual(0);
    expect(result.elementCount).toBeGreaterThan(0);
    expect(result.nestingDepth).toBeGreaterThan(0);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('Hick index grows with interactive count', () => {
    const ir = perceive(DIRTY_CODE);
    const result = density(ir, DEFAULT_CONFIG);

    // Hick index = log2(n + 1)
    const expected = Math.log2(result.interactiveCount + 1);
    expect(result.hickIndex).toBeCloseTo(expected, 2);
  });

  it('warns when interactive count exceeds max', () => {
    const ir = perceive(DIRTY_CODE);
    const cfg = { ...DEFAULT_CONFIG, maxInteractiveChoices: 2 };
    const result = density(ir, cfg);

    if (ir.nodes.filter((n) => n.interactive).length > 2) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});
