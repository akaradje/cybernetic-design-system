/**
 * Design tokens = the "locked spec" the whole system optimizes toward.
 * Everything downstream (grid snapping, contrast, Birkhoff order score)
 * reads from here. Swap this file to re-skin the system for another brand.
 */

/** Tailwind spacing scale -> pixels (4px base grid). This is the hard grid. */
export const SPACING_TOKEN_PX: Record<string, number> = {
  '0': 0, 'px': 1, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10,
  '3': 12, '3.5': 14, '4': 16, '5': 20, '6': 24, '7': 28, '8': 32,
  '9': 36, '10': 40, '11': 44, '12': 48, '14': 56, '16': 64, '20': 80,
  '24': 96, '28': 112, '32': 128, '36': 144, '40': 160, '48': 192,
  '56': 224, '64': 256,
};

/** Reverse map px -> token, used to translate a snapped px back to a class. */
export const PX_TO_TOKEN: Record<number, string> = Object.fromEntries(
  Object.entries(SPACING_TOKEN_PX).map(([t, px]) => [px, t]),
);

export const ALLOWED_GRID_PX: number[] = [
  ...new Set(Object.values(SPACING_TOKEN_PX)),
].sort((a, b) => a - b);

/**
 * A practical slice of the Tailwind palette -> hex, for contrast math.
 * Extend freely; only colors listed here can be contrast-checked.
 */
export const COLOR_HEX: Record<string, string> = {
  white: '#ffffff', black: '#000000', transparent: '#00000000',
  'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1', 'slate-400': '#94a3b8', 'slate-500': '#64748b',
  'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b',
  'slate-900': '#0f172a', 'slate-950': '#020617',
  'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db', 'gray-400': '#9ca3af', 'gray-500': '#6b7280',
  'gray-600': '#4b5563', 'gray-700': '#374151', 'gray-800': '#1f2937',
  'gray-900': '#111827', 'gray-950': '#030712',
  'blue-50': '#eff6ff', 'blue-100': '#dbeafe', 'blue-200': '#bfdbfe',
  'blue-300': '#93c5fd', 'blue-400': '#60a5fa', 'blue-500': '#3b82f6',
  'blue-600': '#2563eb', 'blue-700': '#1d4ed8', 'blue-800': '#1e40af',
  'blue-900': '#1e3a8a', 'blue-950': '#172554',
  'red-400': '#f87171', 'red-500': '#ef4444', 'red-600': '#dc2626',
  'red-700': '#b91c1c', 'red-800': '#991b1b',
  'green-400': '#4ade80', 'green-500': '#22c55e', 'green-600': '#16a34a',
  'green-700': '#15803d',
  'amber-400': '#fbbf24', 'amber-500': '#f59e0b', 'amber-600': '#d97706',
  'indigo-400': '#818cf8', 'indigo-500': '#6366f1', 'indigo-600': '#4f46e5',
  'indigo-700': '#4338ca',
  'violet-500': '#8b5cf6', 'violet-600': '#7c3aed',
  'emerald-500': '#10b981', 'emerald-600': '#059669',
};

/** Tunable limits. These drive the hard constraints and the cost function. */
export interface DesignConfig {
  /** WCAG minimum contrast for normal text. AA = 4.5, AAA = 7. */
  minContrast: number;
  /** Above this many distinct colors, "order" starts dropping (Gestalt similarity). */
  idealDistinctColors: number;
  /** Above this many distinct spacing values, "order" drops. */
  idealDistinctSpacing: number;
  /** Hick's law: interactive choices in one view before it's "heavy". */
  maxInteractiveChoices: number;
  /** Nesting depth before layout reads as over-complex. */
  maxNestingDepth: number;
  /** Reference counts that normalize the Birkhoff complexity term. */
  refElementCount: number;
  refNestingDepth: number;
}

export const DEFAULT_CONFIG: DesignConfig = {
  minContrast: 4.5,
  idealDistinctColors: 5,
  idealDistinctSpacing: 6,
  maxInteractiveChoices: 9,
  maxNestingDepth: 6,
  refElementCount: 30,
  refNestingDepth: 6,
};

export function snapPxToGrid(px: number): { px: number; token: string } {
  let best = ALLOWED_GRID_PX[0];
  for (const v of ALLOWED_GRID_PX) {
    if (Math.abs(v - px) < Math.abs(best - px)) best = v;
  }
  return { px: best, token: PX_TO_TOKEN[best] };
}
