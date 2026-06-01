import { COLOR_HEX } from '../config/tokens';

/**
 * M2.3 — APCA (Advanced Perceptual Contrast Algorithm) — ADVISORY ONLY.
 *
 * APCA is perceptually-uniform, asymmetric (text on background ≠ background on
 * text), and accounts for font size and weight. It outputs a lightness-contrast
 * Lc value (≈ −108…+108).
 *
 * IMPORTANT: APCA is an advisory signal only. The system enforces WCAG 2.x as
 * the hard constraint (legal, stable, tool-compatible). APCA is computed for
 * reporting and to flag "WCAG-pass but APCA-weak" cases (body text, dark mode).
 *
 * Never replace WCAG 2.x with APCA, and never lower a WCAG-passing color on
 * APCA's say-so.
 *
 * Reference: https://github.com/Myndex/SAPC-APCA
 * Status: APCA was exploratory for WCAG 3.0, was pulled from the July 2023
 * working draft. As of 2026, the WCAG 3 contrast algorithm is TBD.
 */

/** APCA contrast result for a single text/bg pair. */
export interface APCAResult {
  /** The Lc value (lightness contrast). Positive = dark text on light bg. */
  lc: number;
  /** Absolute value for threshold comparison. */
  absLc: number;
  /** Polarity: 'positive' = dark-on-light, 'negative' = light-on-dark. */
  polarity: 'positive' | 'negative';
  /** Whether this passes APCA's recommended threshold for the given font size. */
  passes: boolean;
  /** The threshold that was applied. */
  threshold: number;
  /** Advisory flag: WCAG passes but APCA is weak. */
  wcagPassApcWeak: boolean;
  /** The font size in px (default 16). */
  fontPx: number;
  /** The font weight (default 400). */
  fontWeight: number;
}

/** Font size/weight → APCA threshold lookup. */
const APCA_THRESHOLDS: Array<{ minPx: number; minWeight: number; threshold: number }> = [
  { minPx: 0, minWeight: 0, threshold: 75 },    // tiny text, any weight
  { minPx: 12, minWeight: 0, threshold: 70 },    // small text
  { minPx: 14, minWeight: 0, threshold: 60 },    // body text
  { minPx: 16, minWeight: 0, threshold: 55 },    // normal text
  { minPx: 18, minWeight: 0, threshold: 50 },    // large text
  { minPx: 24, minWeight: 0, threshold: 45 },    // heading
  { minPx: 32, minWeight: 0, threshold: 40 },    // large heading
  { minPx: 48, minWeight: 0, threshold: 35 },    // display
  { minPx: 0, minWeight: 700, threshold: -10 },  // bold text gets -10 bonus
];

/**
 * Get the APCA threshold for a given font size and weight.
 * Larger and bolder text needs less contrast.
 */
function getThreshold(fontPx: number, fontWeight: number): number {
  let base = 75; // default for tiny text
  for (const t of APCA_THRESHOLDS) {
    if (fontPx >= t.minPx && t.minWeight <= fontWeight) {
      base = t.threshold;
    }
  }
  // Bold bonus: reduce threshold for bold text
  if (fontWeight >= 700) base -= 10;
  return Math.max(30, base); // minimum threshold
}

/**
 * Convert sRGB (0-255) to linear luminance.
 * Uses the sRGB transfer function.
 */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Compute relative luminance from linear RGB.
 * Same as WCAG 2.x: Y = 0.2126*R + 0.7152*G + 0.0722*B
 */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * Convert hex color to RGB.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length < 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}

/**
 * Compute the APCA Lc value for a text/background pair.
 *
 * The core formula:
 *   Y_text = luminance of text color
 *   Y_bg = luminance of background color
 *
 *   If Y_text > Y_bg (light text on dark bg):
 *     Lc = (Y_bg^0.56 - Y_text^0.57) * 1.14
 *   If Y_text < Y_bg (dark text on light bg):
 *     Lc = (Y_bg^0.62 - Y_text^0.65) * 1.14
 *
 * The exponents (0.56/0.57 vs 0.62/0.65) make APCA asymmetric —
 * light text on dark bg needs more contrast than dark text on light bg.
 */
export function computeAPCA(
  fgHex: string,
  bgHex: string,
  fontPx: number = 16,
  fontWeight: number = 400,
): APCAResult | null {
  const fgRgb = hexToRgb(fgHex);
  const bgRgb = hexToRgb(bgHex);
  if (!fgRgb || !bgRgb) return null;

  const Y_text = luminance(...fgRgb);
  const Y_bg = luminance(...bgRgb);

  // Handle near-black and near-white cases
  const softClipBlack = 0.002;
  const softClipWhite = 0.98;

  let Y_txt = Y_text;
  let Y_back = Y_bg;

  // Soft clip very dark colors
  if (Y_txt < softClipBlack) Y_txt = 0;
  if (Y_back < softClipBlack) Y_back = 0;

  // Soft clip very light colors
  if (Y_txt > softClipWhite) Y_txt = 1;
  if (Y_back > softClipWhite) Y_back = 1;

  let lc: number;
  let polarity: 'positive' | 'negative';

  if (Y_txt > Y_back) {
    // Light text on dark background
    lc = (Math.pow(Y_back, 0.56) - Math.pow(Y_txt, 0.57)) * 1.14;
    polarity = 'negative';
  } else {
    // Dark text on light background
    lc = (Math.pow(Y_back, 0.62) - Math.pow(Y_txt, 0.65)) * 1.14;
    polarity = 'positive';
  }

  // Scale to Lc range (−108..+108) — multiply by 100 per APCA reference.
  lc = lc * 100;

  const absLc = Math.abs(lc);
  const threshold = getThreshold(fontPx, fontWeight);
  const passes = absLc >= threshold;

  return {
    lc: Math.round(lc * 100) / 100,
    absLc: Math.round(absLc * 100) / 100,
    polarity,
    passes,
    threshold,
    wcagPassApcWeak: false, // will be set by caller
    fontPx,
    fontWeight,
  };
}

/**
 * Resolve a Tailwind color token to hex.
 */
function resolveColor(token: string): string | null {
  return COLOR_HEX[token] ?? null;
}

/**
 * Compute APCA for all text/bg pairs in the IR.
 * Returns an array of APCA results with advisory flags.
 */
export function evaluateAPCA(
  elements: Array<{ tag: string; classes: string[] }>,
  wcagContrast: Array<{ fg: string; bg: string; ratio: number; level: string }>,
): APCAResult[] {
  const results: APCAResult[] = [];

  for (const el of elements) {
    const fgCls = el.classes.find((c) => c.startsWith('text-'));
    const bgCls = el.classes.find((c) => c.startsWith('bg-'));
    if (!fgCls || !bgCls) continue;

    const fgToken = fgCls.replace('text-', '');
    const bgToken = bgCls.replace('bg-', '');
    const fgHex = resolveColor(fgToken);
    const bgHex = resolveColor(bgToken);
    if (!fgHex || !bgHex) continue;

    // Infer font size from class (text-sm=14, text-base=16, text-lg=18, etc.)
    const fontPx = inferFontSize(el.classes);
    const fontWeight = inferFontWeight(el.classes);

    const apca = computeAPCA(fgHex, bgHex, fontPx, fontWeight);
    if (!apca) continue;

    // Check if WCAG passes but APCA is weak
    const wcagMatch = wcagContrast.find((c) => c.fg === fgCls && c.bg === bgCls);
    if (wcagMatch && wcagMatch.level !== 'fail' && !apca.passes) {
      apca.wcagPassApcWeak = true;
    }

    results.push(apca);
  }

  return results;
}

/**
 * Infer font size from Tailwind text-* classes.
 */
function inferFontSize(classes: string[]): number {
  const sizeMap: Record<string, number> = {
    'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18,
    'text-xl': 20, 'text-2xl': 24, 'text-3xl': 30, 'text-4xl': 36,
    'text-5xl': 48, 'text-6xl': 60, 'text-7xl': 72, 'text-8xl': 96,
    'text-9xl': 128,
  };
  for (const cls of classes) {
    if (sizeMap[cls]) return sizeMap[cls];
  }
  return 16; // default
}

/**
 * Infer font weight from Tailwind font-* classes.
 */
function inferFontWeight(classes: string[]): number {
  const weightMap: Record<string, number> = {
    'font-thin': 100, 'font-extralight': 200, 'font-light': 300,
    'font-normal': 400, 'font-medium': 500, 'font-semibold': 600,
    'font-bold': 700, 'font-extrabold': 800, 'font-black': 900,
  };
  for (const cls of classes) {
    if (weightMap[cls]) return weightMap[cls];
  }
  return 400; // default
}

/**
 * Format APCA results for the report.
 */
export function formatAPCAReport(results: APCAResult[]): string[] {
  if (results.length === 0) return [];

  const L: string[] = [];
  L.push('  apca (advisory)');
  for (const r of results) {
    const flag = r.wcagPassApcWeak ? ' ⚠ WCAG-pass/APCA-weak' : '';
    const pass = r.passes ? '✓' : '✗';
    L.push(`    Lc=${r.lc} [${pass} ≥${r.threshold}] ${r.polarity}${flag}`);
  }
  return L;
}
