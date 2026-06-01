import { describe, it, expect } from 'vitest';
import { analyze, fix } from '../../src/index';
import { CLEAN_CODE, DIRTY_CODE } from '../setup';

describe('pipeline integration', () => {
  describe('analyze', () => {
    it('returns complete AnalysisResult', () => {
      const result = analyze(DIRTY_CODE);

      expect(result.ir).toBeDefined();
      expect(result.state).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.fixes).toBeDefined();
      expect(result.fixedCode).toBeDefined();
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.report).toBe('string');
    });

    it('detects violations in dirty code', () => {
      const result = analyze(DIRTY_CODE);
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('report contains expected sections', () => {
      const result = analyze(DIRTY_CODE);
      expect(result.report).toContain('Cybernetic Design System');
      expect(result.report).toContain('metrics');
      expect(result.report).toContain('birkhoff');
      expect(result.report).toContain('ngo-14');
      expect(result.report).toContain('contrast');
      expect(result.report).toContain('apca');
    });

    it('accepts partial config overrides', () => {
      const result = analyze(DIRTY_CODE, { minContrast: 7 });
      expect(result.metrics).toBeDefined();
    });
  });

  describe('fix', () => {
    it('returns fixed code and result', () => {
      const { code, result } = fix(DIRTY_CODE);
      expect(typeof code).toBe('string');
      expect(result).toBeDefined();
    });

    it('fixes grid violations', () => {
      const { code } = fix(DIRTY_CODE);
      // The fixed code should not contain arbitrary values
      expect(code).not.toContain('p-[13px]');
      expect(code).not.toContain('mt-[7px]');
    });
  });
});
