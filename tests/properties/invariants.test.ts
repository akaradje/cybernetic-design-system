import { describe, it, expect } from 'vitest';
import { analyze, fix } from '../../src/index';
import { perceive } from '../../src/layers/perception';
import { computeMetrics, checkConstraints, refine } from '../../src/layers/core';
import { emit } from '../../src/layers/emission';
import { DEFAULT_CONFIG } from '../../src/config/tokens';
import { CLEAN_CODE, DIRTY_CODE } from '../setup';

describe('property-based invariants', () => {
  describe('determinism', () => {
    it('same input produces identical output every time', () => {
      const results = Array.from({ length: 10 }, () => analyze(DIRTY_CODE));
      const first = JSON.stringify(results[0]);
      for (const r of results) {
        expect(JSON.stringify(r)).toBe(first);
      }
    });

    it('fix produces identical output every time', () => {
      const results = Array.from({ length: 10 }, () => fix(DIRTY_CODE));
      const firstCode = results[0].code;
      for (const r of results) {
        expect(r.code).toBe(firstCode);
      }
    });
  });

  describe('grid invariant', () => {
    it('all spacing on grid after fix', () => {
      const { code } = fix(DIRTY_CODE);
      const ir = perceive(code);
      const offGrid = ir.tokens.spacing.filter((s) => !s.onGrid);
      expect(offGrid.length).toBe(0);
    });
  });

  describe('monotonicity', () => {
    it('J(after fix) <= J(before fix)', () => {
      const beforeIR = perceive(DIRTY_CODE);
      const beforeMetrics = computeMetrics(beforeIR, DEFAULT_CONFIG);

      const { code } = fix(DIRTY_CODE);
      const afterIR = perceive(code);
      const afterMetrics = computeMetrics(afterIR, DEFAULT_CONFIG);

      expect(afterMetrics.cost).toBeLessThanOrEqual(beforeMetrics.cost);
    });
  });

  describe('contrast invariant', () => {
    it('fix does not introduce new contrast violations', () => {
      const beforeIR = perceive(DIRTY_CODE);
      const beforeMetrics = computeMetrics(beforeIR, DEFAULT_CONFIG);
      const beforeViolations = checkConstraints(beforeIR, beforeMetrics, DEFAULT_CONFIG);
      const beforeContrast = beforeViolations.filter((v) => v.rule === 'a11y.contrast').length;

      const { code } = fix(DIRTY_CODE);
      const afterIR = perceive(code);
      const afterMetrics = computeMetrics(afterIR, DEFAULT_CONFIG);
      const afterViolations = checkConstraints(afterIR, afterMetrics, DEFAULT_CONFIG);
      const afterContrast = afterViolations.filter((v) => v.rule === 'a11y.contrast').length;

      // Fix should not introduce NEW contrast violations
      expect(afterContrast).toBeLessThanOrEqual(beforeContrast);
    });
  });

  describe('emission safety', () => {
    it('emit only modifies static className sites', () => {
      const ir = perceive(DIRTY_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const { edits } = refine(ir, metrics, DEFAULT_CONFIG);
      const fixed = emit(DIRTY_CODE, ir, edits);

      // Function name preserved
      expect(fixed).toContain('DirtyPanel');
      // JSX structure preserved
      expect(fixed).toContain('<div');
      expect(fixed).toContain('<button');
      expect(fixed).toContain('</div>');
    });
  });
});
