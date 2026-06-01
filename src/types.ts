/** Shared types for the pipeline. */

export interface ClassNameSite {
  /** Raw className string as written in source. */
  raw: string;
  /** Char offset of the string contents in the source file (for surgical rewrite). */
  start: number;
  end: number;
  /** False if the className was a dynamic expression we can't safely rewrite. */
  static: boolean;
}

/** Semantic role derived from element tag (drives constraint selection). */
export type SemanticRole =
  | 'button' | 'link' | 'heading' | 'body' | 'input'
  | 'nav' | 'list' | 'container' | 'image' | 'unknown';

export interface SpacingUtility {
  prop: string;        // p, px, mt, gap, space-x, ...
  rawValue: string;    // "3" | "[13px]"
  px: number;          // resolved pixels
  onGrid: boolean;
  classToken: string;  // full original class e.g. "p-[13px]"
  elementTag: string;
  site?: ClassNameSite;
}

/**
 * Design IR node — the canonical element representation.
 * Static path: box is {0,0,0,0} until dynamic perception fills it.
 */
export interface IRNode {
  id: string;                            // sequential: n0, n1, ...
  parent: string | null;                 // parent node id
  role: SemanticRole;                    // derived from tag
  tag: string;                           // raw JSX tag name
  depth: number;                         // nesting depth (1-based)
  box: { x: number; y: number; w: number; h: number };  // computed layout (0 in static path)
  area: number;                          // w * h (0 in static path)
  visualWeight: number;                  // area × saliency (1.0 in static path)
  style: {
    fg?: string;                         // resolved hex
    bg?: string;
    border?: string;
  };
  classes: string[];
  interactive: boolean;
  classSite?: ClassNameSite;             // for emission rewrite
}

/** Token usage summary across the IR. */
export interface TokenUsage {
  colors: string[];                      // distinct color tokens (text-slate-400, bg-white, ...)
  spacing: SpacingUtility[];             // all spacing utilities found
}

/** Source map: links IR nodes back to source file spans. */
export interface SourceMap {
  classSites: ClassNameSite[];           // all static className sites for emission
}

/**
 * The Design Intermediate Representation (§2.4).
 * Renderer-agnostic: same engine works for React/Tailwind, HTML/CSS, or pixel grids.
 */
export interface DesignIR {
  frame: { w: number; h: number };       // viewport / canvas in px (default 1440×900)
  nodes: IRNode[];                        // flattened, with parent refs
  tokens: TokenUsage;                     // resolved token references
  source: SourceMap;                      // IR node ↔ source span
  meta: {
    dpr: number;                          // device pixel ratio
    colorSpace: 'srgb' | 'p3';
    rendered: boolean;                    // false = static path, true = dynamic
  };
}

// ── Legacy types (deprecated — migrate to DesignIR) ──

/** @deprecated Use IRNode instead. */
export interface ElementInfo {
  tag: string;
  depth: number;
  classes: string[];
  classSite?: ClassNameSite;
}

/** @deprecated Use DesignIR instead. */
export interface DesignState {
  elements: ElementInfo[];
  allClasses: string[];
  colorClasses: string[];
  distinctColors: string[];
  spacing: SpacingUtility[];
  distinctSpacingPx: number[];
  nestingDepth: number;
  interactiveCount: number;
  classNameSites: ClassNameSite[];
}

export type Severity = 'hard' | 'soft';

export interface Violation {
  severity: Severity;
  rule: string;
  message: string;
  fixable: boolean;
}

export interface AppliedFix {
  rule: string;
  before: string;
  after: string;
  reason: string;
}

/** Ngo et al. (2003) — 14 layout quality measures, each ∈ [0,1]. */
export interface NGO14Result {
  balance: number;
  equilibrium: number;
  symmetry: number;
  sequence: number;
  cohesion: number;
  unity: number;
  proportion: number;
  simplicity: number;
  density: number;
  regularity: number;
  economy: number;
  homogeneity: number;
  rhythm: number;
  order: number;               // average of the 13 above
}

/** M2.2 — Image-statistic metrics from a rendered screenshot. */
export interface ImageMetricsResult {
  colorfulness: number;          // raw Hasler-Süsstrunk CF value
  clutter: number;               // raw Feature Congestion value
  colorfulnessScore: number;     // 0..1 quality score (moderate = best)
  clutterScore: number;          // 0..1 quality score (moderate = best)
}

export interface Metrics {
  contrast: ContrastResult[];
  apca: APCAResult[];             // APCA advisory (never gating)
  birkhoff: BirkhoffResult;
  ngo14: NGO14Result;
  image: ImageMetricsResult | null;   // null in static path (no screenshot)
  density: DensityResult;
  gridAdherence: number;        // 0..1
  cost: number;                 // lower is better
}

export interface ContrastResult {
  fg: string;
  bg: string;
  ratio: number;
  level: 'AAA' | 'AA' | 'AA-large' | 'fail';
  elementTag: string;
}

/** APCA (Advanced Perceptual Contrast Algorithm) — advisory only. */
export interface APCAResult {
  lc: number;                    // Lc value (lightness contrast)
  absLc: number;                 // absolute value for threshold comparison
  polarity: 'positive' | 'negative';  // positive = dark-on-light
  passes: boolean;               // whether it passes APCA threshold
  threshold: number;             // the threshold applied
  wcagPassApcWeak: boolean;      // advisory: WCAG passes but APCA is weak
  fontPx: number;
  fontWeight: number;
}

export interface BirkhoffResult {
  order: number;        // O, 0..1
  complexity: number;   // C, >= 1
  measure: number;      // M = O / C
  score: number;        // 0..100 presentation score
  breakdown: Record<string, number>;
}

export interface DensityResult {
  interactiveCount: number;
  hickIndex: number;        // relative decision-time index
  elementCount: number;
  nestingDepth: number;
  warnings: string[];
}

export interface AnalysisResult {
  ir: DesignIR;             // the canonical IR
  state: DesignState;       // @deprecated — derived from ir for backward compat
  metrics: Metrics;
  violations: Violation[];
  fixes: AppliedFix[];
  fixedCode: string;
  passed: boolean;          // no remaining hard violations
  report: string;
}
