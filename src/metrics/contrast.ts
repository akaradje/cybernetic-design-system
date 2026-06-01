import { COLOR_HEX } from '../config/tokens';
import type { ContrastResult } from '../types';

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length < 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}

/** WCAG relative luminance. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.1 contrast ratio between two hex colors (1..21). */
export function contrastRatio(fgHex: string, bgHex: string): number | null {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function wcagLevel(ratio: number): ContrastResult['level'] {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

/** Resolve a tailwind color token ("slate-400", "white") to hex. */
export function resolveColor(token: string): string | null {
  return COLOR_HEX[token] ?? null;
}

/**
 * Suggest the nearest accessible shade of the SAME hue that clears `min`
 * against the given background. Returns null if no shade qualifies.
 * (We never change the hue — that's a semantic decision, not a math one.)
 */
export function suggestAccessibleShade(
  fgToken: string,
  bgHex: string,
  min: number,
): string | null {
  const m = fgToken.match(/^([a-z]+)-(\d+)$/);
  if (!m) return null;
  const hue = m[1];
  const shades = Object.keys(COLOR_HEX)
    .filter((k) => k.startsWith(hue + '-'))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
  let best: { token: string; ratio: number } | null = null;
  for (const s of shades) {
    const r = contrastRatio(COLOR_HEX[s], bgHex);
    if (r && r >= min && (!best || r < best.ratio)) best = { token: s, ratio: r };
  }
  return best?.token ?? null;
}
