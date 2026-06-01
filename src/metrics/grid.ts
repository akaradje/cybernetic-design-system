import { SPACING_TOKEN_PX, snapPxToGrid } from '../config/tokens';

const SPACING_PROPS = [
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
];

export interface ParsedSpacing {
  prop: string;
  rawValue: string;
  px: number | null;
  onGrid: boolean;
  classToken: string;
}

/** Parse a single utility class into spacing info, or null if not spacing. */
export function parseSpacingClass(cls: string): ParsedSpacing | null {
  // strip responsive / state prefixes: md:, hover:, etc.
  const bare = cls.includes(':') ? cls.slice(cls.lastIndexOf(':') + 1) : cls;
  const neg = bare.startsWith('-');
  const body = neg ? bare.slice(1) : bare;

  // longest-prefix match so "space-x" wins over "space"
  const prop = SPACING_PROPS
    .filter((p) => body === p || body.startsWith(p + '-'))
    .sort((a, b) => b.length - a.length)[0];
  if (!prop) return null;

  const value = body.slice(prop.length + 1); // after "prop-"
  if (!value) return null;

  // arbitrary value: p-[13px], mt-[0.5rem]
  const arb = value.match(/^\[(.+)\]$/);
  if (arb) {
    const px = parseLengthToPx(arb[1]);
    const onGrid = px !== null && Object.values(SPACING_TOKEN_PX).includes(px);
    return { prop, rawValue: value, px, onGrid, classToken: cls };
  }

  // scale token: p-3, gap-2.5
  if (value in SPACING_TOKEN_PX) {
    const px = SPACING_TOKEN_PX[value] * (neg ? -1 : 1);
    return { prop, rawValue: value, px: Math.abs(px), onGrid: true, classToken: cls };
  }
  // fractional / non-grid token (e.g. p-1/2) -> not on grid
  return { prop, rawValue: value, px: null, onGrid: false, classToken: cls };
}

function parseLengthToPx(s: string): number | null {
  const m = s.match(/^([\d.]+)(px|rem|em)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2] ?? 'px';
  if (unit === 'rem' || unit === 'em') return Math.round(n * 16);
  return Math.round(n);
}

/** Given an off-grid spacing class, produce the snapped replacement class. */
export function snapClass(parsed: ParsedSpacing, originalClass: string): string {
  if (parsed.px === null) return originalClass;
  const { token } = snapPxToGrid(parsed.px);
  const prefix = originalClass.includes(':')
    ? originalClass.slice(0, originalClass.lastIndexOf(':') + 1)
    : '';
  const neg = originalClass.replace(prefix, '').startsWith('-') ? '-' : '';
  return `${prefix}${neg}${parsed.prop}-${token}`;
}
