# Cybernetic Design System (CDS)

A deterministic design-enforcement layer for AI-generated UI. Sits between AI-generated UI and the shipping artifact — turns design quality from a sampling lottery into a bounded optimization problem.

## Quick Reference

```bash
npm run build        # compile TypeScript
npm run check        # run CDS on examples/sample.tsx
npm run test         # run all tests (vitest)
npm run test:kpi     # run KPI tests only
npm run test:coverage # tests with coverage report
```

## Architecture

6-layer pipeline: **M1 Perception → M2 Metric Bank → M3 Constraints → M4 Refinement → M5 Emission → M6 Calibration**

Key principle: **Constraints are truth; agents are advice.** The deterministic engine owns correctness. LLM agents may *propose*; they may never *override* a hard constraint.

### Source Structure

```
src/
├── types.ts              # Core types: DesignIR, IRNode, etc.
├── cli.ts                # CLI entry point
├── index.ts              # Library entry point
├── pixel.ts              # Pixel-art path utilities
├── config/
│   └── tokens.ts         # Design system token spec (grid, type, color, a11y)
├── layers/
│   ├── perception.ts     # M1: AST → IR (static path)
│   ├── dynamic-perception.ts  # M1: Playwright render → computed boxes
│   ├── pixel-perception.ts    # M1: Pixel-art matrix → IR
│   ├── core.ts           # M3: Constraint + Objective engine
│   ├── emission.ts       # M5: IR → source code emission
│   └── pixel-emission.ts # M5: IR → PNG emission
├── metrics/
│   ├── ngo.ts            # M2.1: Ngo 14 geometry measures
│   ├── birkhoff.ts       # M2.1: Birkhoff M=O/C
│   ├── contrast.ts       # M2.3: WCAG 2.x contrast (HARD)
│   ├── apca.ts           # M2.3: APCA perceptual contrast (ADVISORY)
│   ├── grid.ts           # M2.5: Grid/scale/palette compliance
│   ├── density.ts        # M2.4: Cognitive load metrics
│   └── image.ts          # M2.2: Colorfulness + visual clutter
├── constraints/
│   ├── catalog.ts        # Hard constraint catalog g_k(s) ≤ 0
│   └── pareto.ts         # Pareto front reporting
├── refiners/
│   └── cbir.ts           # M4: CBIR loop + deterministic refiners
├── agents/
│   ├── types.ts          # Agent type definitions
│   ├── cage.ts           # Agent cage: Π_F projection + ΔJ gate
│   ├── semantic.ts       # Semantic agent (token intent proposals)
│   ├── aesthetic.ts      # Aesthetic agent (operator ordering)
│   └── orchestrator.ts   # Agent orchestration
└── calibration/
    ├── types.ts           # Calibration type definitions
    ├── collector.ts       # M6: Human rating collector
    └── fitter.ts          # M6: Ridge regression weight fitter
```

## Key Concepts

- **Design IR** — The intermediate representation between all layers. Renderer-agnostic.
- **CBIR (Constraint-Bounded Iterative Refinement)** — The optimization loop. Propose → project → score → accept if improved.
- **The Cage** — For any agent proposal: `commit(p) = Π_F(α_p(s))` applied iff `α_p ∈ A` and `J` improves and no hard constraint violated.
- **Hard constraints** — WCAG 2.x contrast, grid spacing, target size, proximity grouping, token consistency. These block builds.
- **Soft metrics** — Ngo 14, colorfulness, clutter, cognitive load. These shape the objective J(s), never block alone.

## Testing

- Tests are in `tests/` using Vitest
- Golden tests: fixed inputs → byte-exact expected outputs (determinism guard)
- Monotonicity tests: J(after) ≤ J(before) always, g_k ≤ 0 preserved
- Adversarial agent tests: bad LLM proposals → no hard violation committed

## Current Status (from ARCHITECTURE.md §VI)

MVP ships: M1-static, M2.3 (WCAG), M2.5 (grid/palette), scalar J, snapSpacing/normalizeToken/recolorAccessible operators, ΔJ+feasibility gate, M5 emission. Next steps: IR refactor → Dynamic perception → Ngo 14 → Image metrics → Constraint engine v2 → CBIR loop → Agents → APCA → Calibration.
