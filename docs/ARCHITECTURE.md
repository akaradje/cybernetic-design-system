# Cybernetic Design System — Architecture & Research Specification

**Version:** 1.0 (R&D specification)
**Status:** design-complete, implementation-ready
**Scope:** a deterministic, research-grounded enforcement-and-refinement layer that sits
between AI-generated UI and the artifact that ships, turning design quality from a
sampling lottery into a bounded optimization problem.

This document has two jobs:

1. **Research dossier (Part I).** Establish *why* visual quality is partially computable,
   *which* findings are robust, and *where* the science is contested — so every number in
   the system traces back to a citation, not a vibe.
2. **Engineering specification (Parts II–VI).** Define the architecture, the data model,
   every module, every metric formula, the optimization formulation, the bounded-agent
   contract, the rule catalog, and a validation plan precise enough to build from.

A note on honesty up front: the original brief framed this as "MPC" (Model Predictive
Control). A static layout has no continuous time dynamics, so this is **not** literal MPC.
What we keep — and what is genuinely valuable — is the *control-theoretic discipline*:
hard constraints expressed as inequalities, a scalar objective to minimize, and an
**actuator that can only move inside the feasible set**, applied in a receding-horizon
refinement loop. We name this pattern **Constraint-Bounded Iterative Refinement (CBIR)**
and describe it precisely in §2.2.

---

## Part I — Research Foundation

### 1.0 The central claim, and its limits

The system rests on one defensible claim: **a meaningful fraction of perceived visual
quality is predictable from measurable, low-level properties of a layout.** The strongest
single piece of evidence is Reinecke et al. (CHI 2013): computational models of just two
properties — *perceived visual complexity* and *colorfulness* — together with a few
demographic variables explain roughly **half the variance** in aesthetic-appeal ratings
collected after viewers saw a website for only **500 ms** (Reinecke et al., 2013). Half is
a lot for two features; half is also not all of it. The system is therefore designed to
**enforce the computable floor and assist (not replace) human judgment on the rest.**

Why does the computable part exist at all? The leading explanation is the **processing-fluency
theory of aesthetic pleasure** (Reber, Schwarz & Winkielman, 2004): stimuli that the visual
system can process more easily *feel* more pleasant, and that fluency is driven by exactly
the properties we can measure — symmetry, contrast, grouping, repetition, balance. Fluency
also explains the **aesthetic–usability effect**: interfaces that *look* good are *judged*
easier to use, sometimes independent of real usability. This was first shown by Kurosu &
Kashimura (1995), who had 252 participants rate 26 ATM-interface variants and found
apparent beauty correlated with apparent usability *more strongly* than real usability did;
Tractinsky (1997) replicated it with even stronger correlations, and Tractinsky, Katz & Ikar
(2000) showed the link persists after actual use ("what is beautiful is usable"). Recent work
(Press­ler et al., CHI 2023) shows that statistically controlling for processing fluency
*reduces* the effect — consistent with fluency as the common cause.

**Design consequence:** quality is not decoration. A more fluent layout measurably changes
how competent, trustworthy, and usable the product feels. That is the justification for
spending compute on enforcement.

### 1.1 Perceptual grouping — Gestalt → spatial constraints

Gestalt psychology (Wertheimer, 1923; Koffka, 1935) describes how the visual system
organizes raw stimuli into wholes. Four laws translate directly into layout constraints:

- **Proximity** — elements close together are read as a group. ⇒ *Intra-group gaps must be
  strictly smaller than inter-group gaps.* This is the single most violated rule in
  AI-generated UI and the easiest to enforce.
- **Similarity** — elements sharing color/size/shape are read as related. ⇒ *Same role ⇒
  same token; different token ⇒ implies different meaning.* Drives palette and type-scale
  consolidation.
- **Continuity / alignment** — the eye follows aligned edges. ⇒ *Minimize the number of
  distinct alignment lines; elements should share edges.* Quantified by Ngo's *simplicity*.
- **Common region / closure** — shared backgrounds or borders bind elements. ⇒ container
  padding consistency.

These are not stylistic preferences; they are predictions about perception, which is why
they can be checked.

### 1.2 Cognitive load and decision cost

Four quantitative laws bound how much a screen can ask of a user:

- **Miller's law (1956), "7 ± 2."** Working memory holds a small number of chunks. ⇒ cap
  ungrouped peer items; chunk long lists. (Use as a soft heuristic, not dogma — the "magic
  number" is contested; the *principle* of limited working memory is not.)
- **Hick–Hyman law (Hick, 1952; Hyman, 1953).** Decision time grows with the log of the
  number of roughly-equal choices: **T = a + b·log₂(n + 1).** ⇒ the *density* metric for
  interactive controls; favor progressive disclosure over flat menus.
- **Fitts's law (Fitts, 1954).** Time to acquire a target: **MT = a + b·log₂(2D / W)**
  (D = distance, W = target size). ⇒ minimum hit-target sizes, edge/corner placement for
  frequent actions, spacing that keeps targets reachable. (Also the basis of WCAG 2.5.5/2.5.8
  target-size criteria.)
- **Cognitive Load Theory (Sweller, 1988).** Extraneous load — load imposed by presentation
  rather than content — should be minimized. Clutter, low contrast, and inconsistent spacing
  are all extraneous load. ⇒ the clutter and consistency metrics.

### 1.3 Computational aesthetics — the measurement lineage

This is the backbone of the Metric Bank (§3, M2). The lineage:

**Birkhoff (1933) — the original idea.** Aesthetic Measure **M = O / C** (order over
complexity). Historically foundational, *empirically weak* as a literal predictor of human
judgment (it was designed for polygons and vases, and later studies, e.g. Eysenck's, failed
to confirm the simple ratio). We keep **O/C only as an organizing principle**, not a primary
score.

**Ngo, Teo & Byrne (2003) — "Modelling interface aesthetics," *Information Sciences* 152:25–46.**
The pivotal work: **14 computational measures for screen layout**, each normalized to [0, 1]:
*balance, equilibrium, symmetry, sequence, cohesion, unity, proportion, simplicity, density,
regularity, economy, homogeneity, rhythm,* and *order-and-complexity.* Formulas are specified
in §3 (M2). Two honest caveats from the literature:
- The model **assumes the measures are linear and equally weighted** — almost certainly
  false; later work learns weights (see below).
- Validation used hand-picked screens, not controlled experiments. Follow-ups that
  implemented a subset (Zain et al., 2008, five measures; Altaboli & Lin experiments) found
  **balance, equilibrium, symmetry, sequence, unity, and cohesion** to be the most
  influential, with **symmetry and cohesion frequently dominant.** ⇒ the system *weights*
  these higher and exposes weights as config.

**Reinecke et al. (2013) — the image-statistics view.** Rather than geometry of elements,
model the screenshot's *colorfulness* and *visual complexity* directly; ~50% variance at
500 ms (above). Complementary to Ngo: Ngo needs the element tree; Reinecke needs only pixels.
The system computes **both** (geometry metrics + image-statistic metrics) and fuses them.

**Visual clutter — Rosenholtz et al. (2005, 2007).** *Feature Congestion* models clutter from
local variability in color, luminance, and orientation; *Subband Entropy* is an
information-theoretic alternative. Used as the perceptual complexity metric on the rendered
pixels.

**Colorfulness — Hasler & Süsstrunk (2003).** A cheap, well-correlated colorfulness statistic
(formula in M2). This is the practical estimator behind Reinecke's "colorfulness."

**Subjective instruments (ground truth for calibration).** *VisAWI* (Moshagen & Thielsch,
2010) measures perceived website aesthetics along four facets — **simplicity, diversity,
colorfulness, craftsmanship.** *Lavie & Tractinsky (2004)* split aesthetics into **classical**
(clean, orderly, symmetric) and **expressive** (creative, original, fascinating). The system
optimizes primarily for **classical aesthetics** (the computable, fluency-linked part) and
treats expressive aesthetics as out of scope for automated enforcement.

### 1.4 Color and contrast science

- **WCAG 2.1 / 2.2 (W3C).** Contrast ratio from relative luminance,
  **(L₁ + 0.05) / (L₂ + 0.05)**, range 1–21. Thresholds: **4.5:1** normal text, **3:1** large
  text and non-text/UI (1.4.3, 1.4.11). As of 2026 this is the **operative legal/compliance
  standard** worldwide and what auditors and automated checkers use. **This is the system's
  hard gate.**
- **APCA (Advanced Perceptual Contrast Algorithm).** Perceptually-uniform, asymmetric (text
  on background ≠ background on text), accounts for font **size and weight**, outputs a
  *lightness-contrast* **Lc value (≈ −108…+108)**. It models the orange-button and thin-font
  cases WCAG 2.x gets wrong. **Status (important):** APCA was *exploratory* for WCAG 3.0, was
  **pulled from the July 2023 working draft** for lack of working-group support, and as of
  April 2026 the **WCAG 3 contrast algorithm is officially "to be determined."** WCAG 3.0
  itself is a **Working Draft** not expected to reach Recommendation until ~2028–2030.
- **Design decision (dual-track):** enforce **WCAG 2.x as the hard constraint** (legal,
  stable, tool-compatible); compute **APCA as an advisory perceptual signal** (great for
  body-text and dark-mode tuning). Never *replace* WCAG 2.x with APCA, and never lower a
  WCAG-passing color on APCA's say-so.

### 1.5 Spatial and typographic systems (engineering practice)

Less "research," more codified craft, but deterministic and enforceable:

- **Baseline/spacing grid (4 px base; 8-pt grid).** All spacing = multiples of a base unit.
  Removes sub-pixel drift and the "off-by-3px" look. (The MVP already enforces this.)
- **Modular type scale.** Font sizes follow a geometric ratio (1.2 minor third, 1.25 major
  third, 1.333 perfect fourth, 1.5, 1.618 golden). Maps to Ngo's *proportion*.
- **Proportion targets.** "Pleasing" rectangle ratios cluster around 1:1, 1:√2 (1.414),
  1:1.618 (golden), 1:1.732 (√3) — these are the reference set in Ngo's *proportion* measure.
- **Vertical rhythm.** Line-height and vertical margins quantized to the baseline grid ⇒
  Ngo's *rhythm*.

### 1.6 Evidence grading (read before trusting a number)

| Signal | Evidence strength | Use as |
|---|---|---|
| WCAG 2.x contrast | Standardized, legal | **Hard constraint** |
| Spacing/grid consistency | Strong (craft + Gestalt proximity) | **Hard constraint** |
| Hick/Fitts/Miller bounds | Robust laws; thresholds approximate | Soft constraint |
| Ngo: symmetry, balance, cohesion, equilibrium, sequence, unity | Moderate, repeatedly replicated as *most* influential | Weighted objective |
| Ngo: remaining 8 measures | Weak–moderate, equal-weight assumption disputed | Low-weight objective |
| Reinecke complexity + colorfulness | Strong predictive (~50% variance @500 ms) | Weighted objective |
| APCA | Promising, **not standardized**, algorithm in flux | Advisory only |
| Birkhoff M=O/C literal | Weak as predictor | Organizing principle only |

**Rule:** hard constraints must come only from the top two rows. Everything else shapes the
*objective*, never blocks a build on its own.

---

## Part II — System Architecture

### 2.1 Design principles

1. **Constraints are truth; agents are advice.** The deterministic engine owns correctness.
   LLM agents may *propose*; they may never *override* a hard constraint.
2. **Determinism by default.** Same input + same config ⇒ byte-identical output. All
   stochastic steps (LLM proposals) are gated behind a deterministic validator, so the
   *committed* result is reproducible even when proposals are not.
3. **Separate measurement from action.** Metrics never mutate; refiners never measure
   informally — they call the Metric Bank. This keeps the objective honest.
4. **Geometry needs a render.** Many real metrics (balance, symmetry, density) require actual
   pixel/box geometry, not source strings. Perception therefore has a *static* path (tokens,
   semantics, a11y) and a *dynamic* path (computed layout). See M1.
5. **Fail open, report always.** A run never silently changes meaning; non-trivial changes
   are reported, contrast recolors are *suggested* not forced.

### 2.2 The control formulation (CBIR)

Let the design state be an **Intermediate Representation** `s ∈ S` (§2.4). Define:

- **Feasible set** `F = { s : g_k(s) ≤ 0 ∀ k }` — the hard constraints `g_k` (contrast,
  grid, target size, …) as inequalities.
- **Objective** `J(s) = Σ_m w_m · (1 − q_m(s))` — a weighted sum of normalized quality
  metrics `q_m ∈ [0,1]` (Part I), lower is better; weights `w_m` from the evidence grading.
- **Action space** `A = { α : S → S }` — a *closed, audited* set of edit operators (snap
  spacing, normalize token, re-align to grid line, adjust to proportion ratio, dedupe style,
  recolor to nearest accessible same-hue shade, regroup by proximity, …).
- **Projection** `Π_F : S → F` — repairs any state back onto the feasible set
  deterministically (e.g., clamp off-grid to nearest grid step). `Π_F` is what makes the
  cage real: whatever an agent proposes, the committed state is `Π_F(proposal)`.

**The receding-horizon loop (the MPC analogy, made honest):**

```
s ← Π_F(s₀)                       # start feasible
repeat:
    candidates ← propose(s, A)    # deterministic refiners + (optional) LLM agents
    for each candidate edit α:
        s' ← Π_F(α(s))            # apply, then project onto feasible set
        score s' by J             # "predict" outcome via forward model = metrics
    α* ← argmin_α J(Π_F(α(s)))    # pick the best single move this step
    if J improved by > ε: s ← Π_F(α*(s))   # apply one move, re-measure (receding horizon)
    else: break                   # converged
return s
```

This is genuine constrained optimization with a one-step (extensible to k-step) lookahead.
It is *MPC-shaped* — predict, optimize subject to constraints, apply the first move,
re-measure — without pretending a layout has dynamics. Convergence is guaranteed because `J`
is bounded below and strictly decreases each accepted step (with `ε > 0`).

### 2.3 Layered architecture (expanded)

```
            AI-generated UI source  +  (optional) rendered screenshot
                                  │
        ┌─────────────────────────▼──────────────────────────────┐
        │ M1  PERCEPTION                                          │
        │   static:  AST → tokens, semantics, a11y roles          │
        │   dynamic: headless render → computed boxes, pixels     │
        │   output:  Design IR  (§2.4)                            │
        └─────────────────────────┬──────────────────────────────┘
                                  │ Design IR
        ┌─────────────────────────▼──────────────────────────────┐
        │ M2  METRIC BANK   (pure functions, never mutate)        │
        │   geometry:   Ngo 14   ·   image: colorfulness, clutter │
        │   a11y:       WCAG2.x  ·   advisory: APCA               │
        │   cognition:  Hick, Fitts, Miller bounds                │
        │   tokens:     grid/scale/palette compliance             │
        └─────────────────────────┬──────────────────────────────┘
                                  │ metric vector q(s)
        ┌─────────────────────────▼──────────────────────────────┐
        │ M3  CONSTRAINT + OBJECTIVE ENGINE                       │
        │   hard g_k(s) ≤ 0  (block)   ·  soft → objective J(s)   │
        │   feasibility, Pareto front, weight set                 │
        └─────────────────────────┬──────────────────────────────┘
                                  │ violations + J + gradient hints
        ┌─────────────────────────▼──────────────────────────────┐
        │ M4  REFINEMENT  (bounded actuator)                      │
        │   deterministic refiners  +  LLM agents (Semantic,      │
        │   Aesthetic) — all proposals validated by Π_F & ΔJ<0    │
        │   CBIR receding-horizon loop (§2.2)                     │
        └─────────────────────────┬──────────────────────────────┘
                                  │ feasible, improved IR + edit log
        ┌─────────────────────────▼──────────────────────────────┐
        │ M5  EMISSION                                            │
        │   deterministic codegen (IR→source spans) · report ·    │
        │   provenance · pixel-exact raster (for pixel-art path)  │
        └─────────────────────────┬──────────────────────────────┘
                                  │
        ┌─────────────────────────▼──────────────────────────────┐
        │ M6  TELEMETRY / CALIBRATION (optional, offline)         │
        │   collect human ratings → re-fit weights w_m (ridge)    │
        └─────────────────────────────────────────────────────────┘
```

### 2.4 The Design IR (data model)

The IR is the contract between every layer. It is renderer-agnostic so the same engine works
for React/Tailwind, plain HTML/CSS, Figma JSON, or a pixel grid.

```ts
interface DesignIR {
  frame: { w: number; h: number };               // viewport / canvas in px
  nodes: IRNode[];                                // flattened, with parent refs
  tokens: TokenUsage;                             // resolved token references
  source: SourceMap;                              // IR node ↔ source span (for emission)
  meta: { dpr: number; colorSpace: 'srgb'|'p3'; rendered: boolean };
}

interface IRNode {
  id: string;
  parent: string | null;
  role: SemanticRole;                             // button | heading | body | nav | ...
  box: { x: number; y: number; w: number; h: number };   // computed, px (dynamic path)
  area: number;
  visualWeight: number;                           // area × saliency (see M2.0)
  style: {
    fg?: ColorRGBA; bg?: ColorRGBA; border?: ColorRGBA;
    fontPx?: number; fontWeight?: number; lineHeightPx?: number;
    paddingPx?: Box; marginPx?: Box; gapPx?: number; radiusPx?: number;
  };
  classes?: string[];                             // static path
  interactive: boolean;
  textLength?: number;
}
```

**Why both paths:** the static path (classNames/AST) is enough for token compliance,
semantics, and contrast *where colors are literal*. The Ngo geometry metrics need `box` — so
the dynamic path renders the component (headless Chromium via Playwright, or a jsdom + a CSS
layout engine, or for pixel-art a direct matrix) and reads computed bounding boxes. The IR
hides which path produced the geometry.

---

## Part III — Module Specifications

Notation: layout has `n` nodes; node `i` has area `aᵢ`, center `(xᵢ, yᵢ)`, size `(wᵢ, hᵢ)`,
visual weight `ωᵢ`. Frame is `W × H`, center `(X_c, Y_c)`. All quality metrics `q_m ∈ [0,1]`,
1 = best.

### M1 — Perception & IR builder

**Static sub-module.** Parse with a real parser (`@babel/parser` for JSX/TSX; PostCSS for
CSS; an HTML parser for markup). Extract: element tree, `className`/`style` (literal spans
recorded for emission), semantic role (tag + ARIA), interactivity, literal colors and
spacing. *Never* rewrite dynamic expressions; record them as opaque.

**Dynamic sub-module.** Render into a fixed viewport and read computed geometry:
- Preferred: **Playwright** headless → `getBoundingClientRect` per node + a screenshot for
  image-statistic metrics.
- Lightweight: **jsdom + a layout shim** when a browser is unavailable (boxes only, no pixels).
- **Pixel-art path:** input is an `H×W` color matrix; nodes are connected color regions; no
  render needed.

**Saliency for visual weight.** `ωᵢ = aᵢ · (1 + s_contrast,i)` where `s_contrast,i` is the
node's contrast against its background normalized to [0,1] — high-contrast elements pull more
visual weight (matches eye-tracking: contrast and size drive fixation).

**Output:** a fully-populated `DesignIR`.

### M2 — Metric Bank

All functions are pure: `(DesignIR, Config) → number ∈ [0,1]` (or a typed result for
contrast). Grouped below; formulas given in implementable form.

#### M2.0 Geometry preliminaries
Quadrant assignment by node center relative to `(X_c, Y_c)` → {UL, UR, LL, LR}. Per-quadrant
visual weight `W_q = Σ_{i∈q} ωᵢ`.

#### M2.1 Ngo et al. (2003) — 14 measures
Each ∈ [0,1], 1 = best. (Re-expressed in clean notation; the equal-weight assumption of the
original is replaced by learned weights in M3.)

- **Balance** `BM = 1 − (|b_v| + |b_h|)/2`, where for the vertical axis
  `b_v = (W_L − W_R)/max(W_L, W_R)` with `W_side = Σ ωᵢ·dᵢ` (`dᵢ` = distance of center to
  axis); `b_h` analogously top/bottom.
- **Equilibrium** `EM = 1 − (|e_x| + |e_y|)/2`, `e_x = (2·Σ ωᵢ(xᵢ−X_c)) / (n·W·\barω)`,
  `e_y` analogous — center of mass vs. frame center.
- **Symmetry** `SYM = 1 − (|s_v| + |s_h| + |s_r|)/3`: for each axis, compare normalized
  vectors of `{x, y, w, h, distance, angle}` of objects in mirrored quadrants; `s_*` = mean
  absolute normalized difference.
- **Sequence** `SQ = 1 − (Σ_q |rank(W_q) − ideal_q|)/(2(n_q−1))` with reading-order ideal
  `UL > UR > LL > LR` (LTR locales; flip for RTL — locale is a Config input).
- **Cohesion** `CM` — consistency between node aspect ratios and the frame's (and each
  other): `1 − mean |AR_i − AR_frame|` normalized.
- **Unity** `UM` — form unity (few distinct sizes relative to n) combined with space unity
  (uniform inter-object spacing); `UM = (form + space)/2`.
- **Proportion** `PM` — closeness of node and layout ratios to the reference set
  `{1, 1.414, 1.5, 1.618, 1.732}`: `1 − mean min_r |AR_i − r|` (clamped).
- **Simplicity** `SMM = 3 / (n_vap + n_hap + n)` where `n_vap`, `n_hap` = counts of distinct
  vertical/horizontal alignment lines (fewer alignment lines ⇒ simpler).
- **Density** `DM = 1 − |2·(Σ aᵢ / (W·H)) − 1|` — peaks at ~50% area fill.
- **Regularity** `RM = (reg_alignment + reg_spacing)/2` — alignment regularity + spacing
  regularity (how few distinct alignment positions / spacing intervals).
- **Economy** `ECM = 1 / |distinct sizes|` — penalizes many distinct element sizes.
- **Homogeneity** `HM` — evenness of object counts across the four quadrants (max when
  `n/4` each), computed via a normalized multinomial spread.
- **Rhythm** `RHM = 1 − (|r_x| + |r_y| + |r_a|)/3` — regularity of variation in x-position,
  y-position, and area.
- **Order & Complexity** `OM = (Σ of the 13 normalized measures)/13` — Birkhoff-style
  rollup, exposed for reporting but **not** used as the primary score (weights live in M3).

> Weighting (from §1.3 evidence): default `w` emphasizes symmetry, cohesion, balance,
> equilibrium, sequence, unity; the other measures get low weight. All weights are Config.

#### M2.2 Image-statistic metrics (need the screenshot)
- **Colorfulness (Hasler & Süsstrunk, 2003).** With `rg = R − G`, `yb = ½(R + G) − B`:
  `CF = √(σ²_rg + σ²_yb) + 0.3·√(μ²_rg + μ²_yb)`, then mapped to a target band (too low = drab,
  too high = garish; Reinecke's data informs the band).
- **Visual clutter (Rosenholtz Feature Congestion / Subband Entropy).** Local variability in
  color, luminance, orientation → a clutter scalar; mapped so moderate complexity scores best.

#### M2.3 Accessibility (hard) + perceptual (advisory)
- **WCAG 2.x contrast (HARD).** Relative-luminance ratio (implemented in `metrics/contrast.ts`).
  Thresholds 4.5 / 3.0 by text size and role.
- **APCA Lc (ADVISORY).** Perceptual lightness-contrast with size/weight thresholds; reported,
  never gating. Flag: "WCAG-pass but APCA-weak" for body text and dark mode.
- **Target size (Fitts / WCAG 2.5.8).** Interactive box ≥ 24×24 px (AA) / 44×44 px (AAA).

#### M2.4 Cognitive-load metrics
- **Hick index** `T̂ = log₂(n_interactive + 1)` per view; soft-cap from Config.
- **Miller chunking** — flag ungrouped peer sets > 7±2.
- **Reading/scan cost** — Fitts-based estimate over the primary action path.

#### M2.5 Token-compliance metrics (deterministic, from the MVP)
Grid adherence, palette size, type-scale adherence, radius/elevation token adherence — each a
fraction in [0,1]. These are both *metrics* (feed J) and *hard constraints* (grid).

### M3 — Constraint & Objective engine

**Hard constraint catalog** `g_k(s) ≤ 0` (any positive ⇒ build fails / blocks in `--strict`):

| `g_k` | Source |
|---|---|
| every spacing on grid | §1.5 + Gestalt proximity |
| WCAG 2.x contrast ≥ threshold (by size/role) | §1.4 |
| interactive target ≥ 24 px | §1.2 Fitts / WCAG 2.5.8 |
| intra-group gap < inter-group gap | §1.1 proximity |
| no two semantically-different roles share an identical token set | §1.1 similarity |

**Objective** `J(s) = Σ_m w_m (1 − q_m(s))` over the soft metrics (M2.1 minus grid, M2.2,
M2.4, APCA). Weights default from evidence grading; calibratable in M6.

**Feasibility & Pareto.** When multiple feasible candidates exist, rank by `J`; expose the
**Pareto front** across the top metric groups (a11y / order / complexity) so a human can pick
a trade-off instead of accepting a single scalarization. Scalarization weights are the default;
Pareto is the inspection tool.

### M4 — Refinement (the bounded actuator)

**Action space `A` (closed & audited).** Each operator is a pure `IRNode[]→IRNode[]` edit with
a declared *precondition* and *guarantee*:

| Operator | Effect | Guarantee |
|---|---|---|
| `snapSpacing` | off-grid → nearest grid step | never leaves grid |
| `normalizeToken` | arbitrary value → scale token | value unchanged ± ½ step |
| `realign` | snap edge to nearest shared alignment line | reduces `n_vap+n_hap` |
| `toProportion` | resize toward nearest reference ratio | within tolerance |
| `dedupeStyle` | merge identical style sets | semantics preserved |
| `recolorAccessible` | nearest **same-hue** shade clearing WCAG | *suggested*, not auto |
| `regroupProximity` | adjust gaps so groups separate | proximity holds |

**Agents (optional LLM, strictly bounded):**
- **Semantic Agent** — reads role/context ("destructive action") and *proposes* token intent
  (e.g., danger palette for a delete button). It proposes a *token choice within `A`*, never a
  raw value.
- **Aesthetic Agent** — proposes which operators to try and in what order (a search heuristic),
  e.g., "regroup then realign." It cannot invent operators outside `A`.

**The cage (formal guarantee).** For any proposal `p` from any agent:
`commit(p) = Π_F(α_p(s))` is applied **iff** `α_p ∈ A` **and** `J(Π_F(α_p(s))) < J(s) − ε`
**and** no `g_k` becomes positive. Therefore *no agent, however creative or adversarial, can
reduce accessibility or push spacing off-grid.* Determinism of the committed result follows
from `Π_F` and the `ΔJ` gate even though proposals may be stochastic.

**Loop.** Run CBIR (§2.2) to convergence or a step budget. Default: deterministic refiners
only (fully reproducible); agents are opt-in.

### M5 — Emission

- **Code path.** Apply IR edits back to the recorded source spans, right-to-left, touching
  only static `className`/`style` literals (as in the MVP). Output is byte-deterministic.
- **Provenance.** Emit an edit log: `{operator, before, after, ΔJ, rule}` per change.
- **Report.** Machine + human formats (status, `J`, per-metric vector, hard violations, fixes,
  suggestions, Pareto alternatives).
- **Pixel-art path.** The IR is a color matrix; emission writes a 1:1 PNG with no resampling
  (symmetry/composition already enforced as constraints), guaranteeing crisp pixels.

### M6 — Telemetry & calibration (offline, optional)

The equal-weight assumption is the weakest link (§1.3). Close the loop: collect human pairwise
or Likert aesthetic ratings on emitted screens, then **re-fit `w_m`** via ridge regression /
ordinal logistic on the metric vectors (this is exactly how Reinecke and successors built
predictive models). Ship calibrated default weights per locale/brand. Never let live user
input change hard constraints — only soft weights.

---

## Part IV — Token & Rule System (the locked spec)

**Token schema** (extends the MVP's `config/tokens.ts`):

```ts
interface DesignSystemSpec {
  grid: { basePx: number; scalePx: number[] };
  type: { basePx: number; ratio: number; steps: number };       // modular scale
  color: { palette: Record<string, OKLCHorHex>; roles: Record<SemanticRole,string> };
  radius: number[]; elevation: ShadowToken[];
  proportionTargets: number[];                                   // [1,1.414,1.5,1.618,1.732]
  a11y: { minContrastBody: 4.5; minContrastLarge: 3; minTargetPx: 24 };
  locale: { reading: 'ltr' | 'rtl' };
  weights: Record<MetricName, number>;                           // objective weights
  thresholds: { hickMax: number; densitySweet: 0.5; clutterBand: [number,number]; cfBand: [number,number] };
}
```

> Prefer **OKLCH** for palette definitions: perceptually-uniform lightness makes
> "nearest accessible same-hue shade" (the `recolorAccessible` operator) well-defined.

**Rule catalog** is the union of M3's hard table and the soft metrics, each row carrying:
`id, severity (hard|soft), metric, threshold, fix-operator|null, citation`. This table is the
single source of truth; the README's MVP rules are its first rows.

---

## Part V — Evaluation & Validation

**Validate the metrics (do they track humans?).**
- **Datasets:** *Rico* (≈72k mobile UI screens + view hierarchies) and *Enrico* (curated,
  topic-labeled subset) give real layouts with element boxes — ideal for the geometry metrics.
  Reinecke's website-screenshot set / *LabInTheWild* data for the image-statistic metrics.
- **Procedure:** compute metric vectors, collect human aesthetic ratings (VisAWI facets), report
  correlation per metric and variance-explained for the fused `J`. Target: match the published
  ~0.5 R² ceiling for first-impression appeal; treat anything far below as a metric bug.

**Validate the system (does it improve and never regress?).**
- **Golden tests:** fixed inputs → byte-exact expected outputs (determinism guard).
- **Monotonicity test:** for random feasible edits, `J(after) ≤ J(before)` always (the `ΔJ`
  gate); `g_k ≤ 0` preserved (the cage).
- **Adversarial agent test:** feed deliberately bad LLM proposals; assert no hard violation is
  ever committed.
- **A/B human study:** emitted vs. raw AI output, VisAWI + task-time; the real-world KPI.

**System KPIs:** % first-pass feasible, mean `ΔJ` per run, hard-violation escape rate (target
0), p95 latency per component, determinism rate (target 100%).

---

## Part VI — Implementation roadmap (maps to the existing codebase)

The MVP (this repo) already ships M1-static, M2.3 (WCAG), M2.5 (grid/palette), a scalar `J`,
the `snapSpacing`/`normalizeToken`/`recolorAccessible` operators, the cage's `ΔJ`+feasibility
gate, M5 code emission, and the Claude Code hook. Build order from here:

1. **IR refactor** — replace the ad-hoc `DesignState` with `DesignIR` (§2.4); add `SourceMap`.
   *Low risk, unblocks everything.*
2. **Dynamic perception** — Playwright path for computed boxes + screenshot (`M1`).
3. **Geometry metrics** — implement Ngo 14 (`M2.1`) against `box` data; wire into `J` with
   evidence-based default weights.
4. **Image metrics** — colorfulness (Hasler-Süsstrunk) + clutter (`M2.2`).
5. **Constraint engine v2** — formal `g_k` table, Pareto reporting (`M3`).
6. **CBIR loop + more operators** — `realign`, `toProportion`, `regroupProximity`; multi-step
   horizon (`M4`).
7. **Agents (opt-in)** — Semantic + Aesthetic, behind the cage (`M4`).
8. **APCA advisory** (`M2.3`), **pixel-art path** (`M1`/`M5`).
9. **Calibration harness** on Rico/VisAWI (`M6`).

Each step keeps the previous guarantees: determinism, the cage, fail-open reporting.

---

## References

- Birkhoff, G. D. (1933). *Aesthetic Measure.* Harvard University Press.
- Fitts, P. M. (1954). The information capacity of the human motor system in controlling the
  amplitude of movement. *Journal of Experimental Psychology*, 47(6), 381–391.
- Hasler, D., & Süsstrunk, S. (2003). Measuring colorfulness in natural images.
  *Proc. SPIE Human Vision and Electronic Imaging VIII*, 5007, 87–95.
- Hick, W. E. (1952). On the rate of gain of information. *Quarterly Journal of Experimental
  Psychology*, 4(1), 11–26.
- Hyman, R. (1953). Stimulus information as a determinant of reaction time. *Journal of
  Experimental Psychology*, 45(3), 188–196.
- Koffka, K. (1935). *Principles of Gestalt Psychology.* Harcourt, Brace.
- Kurosu, M., & Kashimura, K. (1995). Apparent usability vs. inherent usability. *CHI ’95
  Conference Companion*, 292–293.
- Lavie, T., & Tractinsky, N. (2004). Assessing dimensions of perceived visual aesthetics of
  web sites. *International Journal of Human-Computer Studies*, 60(3), 269–298.
- Miller, G. A. (1956). The magical number seven, plus or minus two. *Psychological Review*,
  63(2), 81–97.
- Moshagen, M., & Thielsch, M. T. (2010). Facets of visual aesthetics (VisAWI). *International
  Journal of Human-Computer Studies*, 68(10), 689–709.
- Ngo, D. C. L., Teo, L. S., & Byrne, J. G. (2003). Modelling interface aesthetics.
  *Information Sciences*, 152, 25–46.
- Preßler, J., et al. (2023). Statistically controlling for processing fluency reduces the
  aesthetic-usability effect. *CHI ’23 Extended Abstracts.*
- Reber, R., Schwarz, N., & Winkielman, P. (2004). Processing fluency and aesthetic pleasure.
  *Personality and Social Psychology Review*, 8(4), 364–382.
- Reinecke, K., et al. (2013). Predicting users’ first impressions of website aesthetics with a
  quantification of perceived visual complexity and colorfulness. *CHI ’13*, 2049–2058.
- Rosenholtz, R., Li, Y., & Nakano, L. (2007). Measuring visual clutter. *Journal of Vision*,
  7(2):17.
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12(2), 257–285.
- Tractinsky, N. (1997). Aesthetics and apparent usability. *CHI ’97*, 115–122.
- Tractinsky, N., Katz, A. S., & Ikar, D. (2000). What is beautiful is usable. *Interacting with
  Computers*, 13(2), 127–145.
- W3C. *Web Content Accessibility Guidelines (WCAG) 2.1 / 2.2.* (Operative standard, 2026.)
- W3C. *WCAG 3.0 Working Draft* and APCA exploratory contrast work (algorithm undetermined as of
  2026).
- Wertheimer, M. (1923). Laws of organization in perceptual forms. (Gestalt principles.)
- Zain, J. M., Tey, M., & Goh, Y. (2008/2011). Probing a self-developed aesthetics measurement
  application (SDA). *(implements 6 of Ngo’s measures.)*
- Deka, B., et al. (2017). Rico: A mobile app dataset for building data-driven design
  applications. *UIST ’17.*
