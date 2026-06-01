import { describe, it, expect } from 'vitest';
import { contrastRatio, wcagLevel, resolveColor, suggestAccessibleShade } from '../../../src/metrics/contrast';

describe('contrast', () => {
  describe('contrastRatio', () => {
    it('returns 21:1 for black on white', () => {
      const ratio = contrastRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('returns 1:1 for same color', () => {
      const ratio = contrastRatio('#808080', '#808080');
      expect(ratio).toBeCloseTo(1, 1);
    });

    it('returns null for invalid hex', () => {
      expect(contrastRatio('invalid', '#ffffff')).toBeNull();
      expect(contrastRatio('#000000', 'invalid')).toBeNull();
    });

    it('is symmetric (fg/bg order doesn\'t matter)', () => {
      const a = contrastRatio('#000000', '#ffffff');
      const b = contrastRatio('#ffffff', '#000000');
      expect(a).toBeCloseTo(b!, 2);
    });
  });

  describe('wcagLevel', () => {
    it('returns AAA for ratio >= 7', () => {
      expect(wcagLevel(7)).toBe('AAA');
      expect(wcagLevel(10)).toBe('AAA');
    });

    it('returns AA for ratio >= 4.5', () => {
      expect(wcagLevel(4.5)).toBe('AA');
      expect(wcagLevel(6)).toBe('AA');
    });

    it('returns AA-large for ratio >= 3', () => {
      expect(wcagLevel(3)).toBe('AA-large');
      expect(wcagLevel(4)).toBe('AA-large');
    });

    it('returns fail for ratio < 3', () => {
      expect(wcagLevel(2)).toBe('fail');
      expect(wcagLevel(1)).toBe('fail');
    });
  });

  describe('resolveColor', () => {
    it('resolves known tokens', () => {
      expect(resolveColor('white')).toBe('#ffffff');
      expect(resolveColor('black')).toBe('#000000');
      expect(resolveColor('blue-600')).toBe('#2563eb');
    });

    it('returns null for unknown tokens', () => {
      expect(resolveColor('nonexistent')).toBeNull();
    });
  });

  describe('suggestAccessibleShade', () => {
    it('suggests a darker shade when contrast is too low', () => {
      const suggestion = suggestAccessibleShade('slate-400', '#ffffff', 4.5);
      expect(suggestion).toBeTruthy();
      expect(suggestion).toMatch(/^slate-\d+$/);
    });

    it('returns null when no shade qualifies', () => {
      // white on white — no shade of white will help
      const suggestion = suggestAccessibleShade('white', '#ffffff', 4.5);
      expect(suggestion).toBeNull();
    });
  });
});
