import { describe, it, expect } from 'vitest';
import { computeAPCA } from '../../../src/metrics/apca';

describe('apca', () => {
  it('returns positive Lc for dark text on light bg', () => {
    const result = computeAPCA('#000000', '#ffffff');
    expect(result).toBeTruthy();
    expect(result!.lc).toBeGreaterThan(0);
    expect(result!.polarity).toBe('positive');
  });

  it('returns negative Lc for light text on dark bg', () => {
    const result = computeAPCA('#ffffff', '#000000');
    expect(result).toBeTruthy();
    expect(result!.lc).toBeLessThan(0);
    expect(result!.polarity).toBe('negative');
  });

  it('Lc is in expected range (-120 to +120)', () => {
    const result = computeAPCA('#000000', '#ffffff');
    expect(result).toBeTruthy();
    expect(Math.abs(result!.lc)).toBeLessThanOrEqual(120);
  });

  it('returns null for invalid colors', () => {
    expect(computeAPCA('invalid', '#ffffff')).toBeNull();
  });

  it('accounts for font size (larger text needs less contrast)', () => {
    const small = computeAPCA('#666666', '#ffffff', 12);
    const large = computeAPCA('#666666', '#ffffff', 24);
    expect(small).toBeTruthy();
    expect(large).toBeTruthy();
    // Larger text has a lower threshold
    expect(large!.threshold).toBeLessThanOrEqual(small!.threshold);
  });

  it('accounts for font weight (bold text needs less contrast)', () => {
    const normal = computeAPCA('#666666', '#ffffff', 16, 400);
    const bold = computeAPCA('#666666', '#ffffff', 16, 700);
    expect(normal).toBeTruthy();
    expect(bold).toBeTruthy();
    // Bold text has a lower threshold
    expect(bold!.threshold).toBeLessThanOrEqual(normal!.threshold);
  });
});
