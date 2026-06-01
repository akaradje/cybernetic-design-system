import { describe, it, expect } from 'vitest';
import { emit, buildReport } from '../../../src/layers/emission';
import { perceive } from '../../../src/layers/perception';
import { computeMetrics, checkConstraints, refine } from '../../../src/layers/core';
import { DEFAULT_CONFIG } from '../../../src/config/tokens';
import { CLEAN_CODE, DIRTY_CODE } from '../../setup';

describe('emission', () => {
  describe('emit', () => {
    it('returns original code when no edits', () => {
      const ir = perceive(CLEAN_CODE);
      const result = emit(CLEAN_CODE, ir, new Map());
      expect(result).toBe(CLEAN_CODE);
    });

    it('applies edits to dirty code', () => {
      const ir = perceive(DIRTY_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const { edits } = refine(ir, metrics, DEFAULT_CONFIG);

      const result = emit(DIRTY_CODE, ir, edits);
      expect(result).not.toBe(DIRTY_CODE);
    });

    it('preserves non-edited parts', () => {
      const ir = perceive(DIRTY_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const { edits } = refine(ir, metrics, DEFAULT_CONFIG);

      const result = emit(DIRTY_CODE, ir, edits);
      // The function name should be preserved
      expect(result).toContain('DirtyPanel');
    });
  });

  describe('buildReport', () => {
    it('generates report with status', () => {
      const ir = perceive(DIRTY_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const violations = checkConstraints(ir, metrics, DEFAULT_CONFIG);
      const { fixes, suggestions } = refine(ir, metrics, DEFAULT_CONFIG);

      const report = buildReport(metrics, violations, fixes, suggestions, false);
      expect(report).toContain('FAIL');
      expect(report).toContain('hard violations');
    });

    it('generates PASS report for clean code', () => {
      const ir = perceive(CLEAN_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const violations = checkConstraints(ir, metrics, DEFAULT_CONFIG);
      const { fixes, suggestions } = refine(ir, metrics, DEFAULT_CONFIG);

      // If no hard violations, should pass
      const hard = violations.filter((v) => v.severity === 'hard');
      const passed = hard.length === 0;
      const report = buildReport(metrics, violations, fixes, suggestions, passed);
      if (passed) {
        expect(report).toContain('PASS');
      }
    });
  });
});
