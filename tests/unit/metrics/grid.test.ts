import { describe, it, expect } from 'vitest';
import { parseSpacingClass, snapClass } from '../../../src/metrics/grid';

describe('grid', () => {
  describe('parseSpacingClass', () => {
    it('parses standard tokens', () => {
      const result = parseSpacingClass('p-4');
      expect(result).toBeTruthy();
      expect(result!.prop).toBe('p');
      expect(result!.px).toBe(16);
      expect(result!.onGrid).toBe(true);
    });

    it('parses arbitrary values', () => {
      const result = parseSpacingClass('p-[13px]');
      expect(result).toBeTruthy();
      expect(result!.prop).toBe('p');
      expect(result!.px).toBe(13);
      expect(result!.onGrid).toBe(false);
    });

    it('parses gap classes', () => {
      const result = parseSpacingClass('gap-2');
      expect(result).toBeTruthy();
      expect(result!.prop).toBe('gap');
      expect(result!.px).toBe(8);
    });

    it('parses responsive prefixes', () => {
      const result = parseSpacingClass('md:p-4');
      expect(result).toBeTruthy();
      expect(result!.prop).toBe('p');
      expect(result!.px).toBe(16);
    });

    it('returns null for non-spacing classes', () => {
      expect(parseSpacingClass('text-white')).toBeNull();
      expect(parseSpacingClass('bg-blue-600')).toBeNull();
    });
  });

  describe('snapClass', () => {
    it('snaps off-grid values to nearest grid step', () => {
      const parsed = parseSpacingClass('p-[13px]')!;
      const snapped = snapClass(parsed, 'p-[13px]');
      expect(snapped).toBe('p-3'); // 12px is nearest
    });

    it('preserves responsive prefixes', () => {
      const parsed = parseSpacingClass('md:p-[13px]')!;
      const snapped = snapClass(parsed, 'md:p-[13px]');
      expect(snapped).toBe('md:p-3');
    });
  });
});
