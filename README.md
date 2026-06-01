<![CDATA[<div align="center">

# 🎨 Cybernetic Design System (CDS)

**A deterministic design-enforcement layer for AI-generated UI**

<br>

![npm version](https://img.shields.io/npm/v/cybernetic-design-system.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)

<br>

[Installation](#-installation) · [Quick Start](#-quick-start) · [CLI](#-cli-commands) · [MCP Server](#-mcp-server-for-claude-code) · [API](#-library-api) · [Architecture](#-architecture)

</div>

---

## 📖 Overview

CDS sits between AI-generated UI code and what actually lands in your repo. It turns "taste" into checkable math:

- **Spacing grid** — 4px base grid enforcement
- **WCAG contrast** — 2.1/2.2 accessibility compliance
- **Palette consistency** — color count optimization
- **Cognitive load** — Hick-Hyman, Fitts, Miller bounds
- **Aesthetic metrics** — Birkhoff, Ngo 14 geometry, APCA perceptual contrast
- **Bounded auto-fix** — agents can only move within the envelope constraints allow

> **Design Principle:** Constraints are truth; agents are advice. The deterministic engine owns correctness. LLM agents may *propose*; they may never *override* a hard constraint.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 Static Analysis | AST parsing, metrics computation, violation detection |
| 🔧 Auto-Fix | Grid snapping, token normalization, contrast suggestions |
| 🔄 CBIR Loop | Constraint-Bounded Iterative Refinement until convergence |
| 🤖 Agent Orchestration | Semantic + Aesthetic agents behind the cage |
| 🎯 MCP Server | Native Claude Code integration via Model Context Protocol |
| 🎨 Pixel Art | H×W color matrix analysis with symmetry enforcement |
| 📊 Calibration | Ridge regression weight fitting from human ratings |
| ⚡ Deterministic | Same input → byte-identical output |

---

## 🚀 Installation

### Prerequisites

- Node.js ≥ 18
- npm or yarn

### Install

```bash
git clone https://github.com/akaradje/cybernetic-design-system.git
cd cybernetic-design-system
npm install
npm run build
npm test
```

### Global CLI (optional)

```bash
npm link
```

---

## ⚡ Quick Start

```bash
# Analyze a component
node dist/cli.js src/components/Button.tsx

# Auto-fix grid violations
node dist/cli.js src/components/Button.tsx --fix

# Run CBIR refinement loop
node dist/cli.js src/components/Button.tsx --cbir

# Run agent orchestration
node dist/cli.js src/components/Button.tsx --agents
```

---

## 🛠️ CLI Commands

```
node dist/cli.js <file>              # Static analysis (default)
node dist/cli.js <file> --fix        # Auto-fix grid violations
node dist/cli.js <file> --cbir       # CBIR refinement loop
node dist/cli.js <file> --agents     # Agent orchestration
node dist/cli.js <file> --dynamic    # Playwright dynamic analysis
node dist/cli.js <file> --json       # JSON output
node dist/cli.js <file> --strict     # Exit 2 on violations (CI)
echo '<json>' | node dist/cli.js --pixel     # Pixel art analysis
node dist/cli.js --calibrate < ratings.json  # Calibration
```

---

## 🔌 MCP Server for Claude Code

CDS includes a native MCP server for seamless Claude Code integration.

### Setup

```bash
npm run build
claude mcp add --transport stdio -s user cds -- node /path/to/dist/mcp-server.js
claude mcp list
```

### Available Tools

| Tool | Description |
|------|-------------|
| `cds-analyze` | Static analysis with metrics, violations, suggestions |
| `cds-fix` | Analyze + auto-fix grid/spacing violations |
| `cds-cbir` | CBIR refinement loop until convergence |
| `cds-agents` | Agent orchestration behind the cage |
| `cds-check-file` | Analyze file on disk with optional write-back |

### Usage in Claude Code

```
"Analyze src/components/Card.tsx with CDS"
"Fix design violations in page.tsx"
"Run CBIR refinement on layout.tsx"
```

### PostToolUse Hook (Optional)

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "node .claude/hooks/cds.mjs",
        "timeout": 20
      }]
    }]
  }
}
```

---

## 📚 Library API

### analyze()

```typescript
import { analyze } from './src/index';

const result = analyze(code);
console.log(result.passed);       // true/false
console.log(result.metrics.cost); // J cost
console.log(result.violations);   // violations array
console.log(result.report);       // human-readable report
```

### fix()

```typescript
import { fix } from './src/index';
const { code: fixedCode, result } = fix(dirtyCode);
```

### cbir()

```typescript
import { cbir, DEFAULT_CONFIG } from './src/index';
const result = cbir(code, DEFAULT_CONFIG);
console.log(result.iterations);   // iterations to converge
console.log(result.improvement);  // ΔJ improvement
console.log(result.code);         // optimized code
```

### orchestrate()

```typescript
import { orchestrate, DEFAULT_CONFIG } from './src/index';
const result = orchestrate(code, DEFAULT_CONFIG);
console.log(result.acceptedCount);  // accepted proposals
console.log(result.rejectedCount);  // rejected proposals
```

### analyzeDynamic()

```typescript
import { analyzeDynamic } from './src/index';
const result = await analyzeDynamic(code, {}, {
  width: 1440,
  height: 900,
  captureScreenshot: true,
});
```

---

## 🏗️ Architecture

```
M1 PERCEPTION
   static:  AST → tokens, semantics, a11y roles
   dynamic: Playwright → computed boxes, pixels
   pixel:   H×W color matrix → connected regions
       │
       ▼
M2 METRIC BANK
   geometry:   Ngo 14 measures
   image:      colorfulness, clutter
   a11y:       WCAG 2.x, APCA (advisory)
   cognition:  Hick, Fitts, Miller bounds
   tokens:     grid/scale/palette compliance
       │
       ▼
M3 CONSTRAINT + OBJECTIVE ENGINE
   hard g_k(s) ≤ 0  (block)
   soft → objective J(s)
   Pareto front reporting
       │
       ▼
M4 REFINEMENT (bounded actuator)
   deterministic refiners
   LLM agents (Semantic, Aesthetic)
   CBIR receding-horizon loop
   cage: Π_F + ΔJ gate
       │
       ▼
M5 EMISSION
   deterministic codegen (IR→source spans)
   pixel-art PNG emission
   report generation
       │
       ▼
M6 TELEMETRY / CALIBRATION
   collect human ratings
   re-fit weights (ridge regression)
```

### Source Structure

```
src/
├── index.ts                    # Public API
├── cli.ts                      # CLI entry point
├── mcp-server.ts               # MCP server for Claude Code
├── pixel.ts                    # Pixel-art API
├── types.ts                    # Core types
├── config/
│   └── tokens.ts               # Design tokens + thresholds
├── layers/
│   ├── perception.ts           # AST → DesignIR
│   ├── dynamic-perception.ts   # Playwright → boxes
│   ├── pixel-perception.ts     # Pixel grid → DesignIR
│   ├── core.ts                 # Metrics + constraints
│   ├── emission.ts             # IR → source rewrite
│   └── pixel-emission.ts       # IR → PNG
├── metrics/
│   ├── contrast.ts             # WCAG 2.1 contrast
│   ├── apca.ts                 # APCA perceptual contrast
│   ├── birkhoff.ts             # M = O/C aesthetic
│   ├── ngo.ts                  # Ngo 14 geometry
│   ├── grid.ts                 # Spacing parse + snap
│   ├── density.ts              # Hick-Hyman cognitive load
│   └── image.ts                # Colorfulness + clutter
├── constraints/
│   ├── catalog.ts              # Formal g_k constraint table
│   └── pareto.ts               # Pareto front analysis
├── refiners/
│   └── cbir.ts                 # CBIR receding-horizon loop
├── agents/
│   ├── types.ts                # Agent interfaces
│   ├── semantic.ts             # Semantic Agent
│   ├── aesthetic.ts            # Aesthetic Agent
│   ├── cage.ts                 # Π_F + ΔJ gate
│   └── orchestrator.ts         # Agent orchestration
└── calibration/
    ├── types.ts                # Rating + weights types
    ├── collector.ts            # Metric vector collector
    ├── fitter.ts               # Ridge regression
    └── index.ts                # Public API
```

---

## 📊 KPIs

| KPI | Target | Measured |
|-----|--------|----------|
| Determinism rate | 100% | ✅ 100% |
| Hard-violation escape rate | 0% | ✅ 0% |
| First-pass feasible rate | ≥50% | ✅ 50% |
| Mean ΔJ per CBIR run | ≥0 | ✅ ≥0 |
| Grid adherence after fix | 100% | ✅ 100% |
| APCA advisory coverage | 100% | ✅ 100% |
| Agent cage safety | 0 | ✅ 0 |
| Calibration R² | ≥0 | ✅ 0.608 |
| p95 latency | <2000ms | ✅ 0.64ms |

---

## ⚙️ Configuration

```typescript
import { analyze, DEFAULT_CONFIG } from './src/index';

const result = analyze(code, {
  minContrast: 4.5,              // WCAG AA (use 7 for AAA)
  idealDistinctColors: 5,        // max palette size
  idealDistinctSpacing: 6,       // max spacing values
  maxInteractiveChoices: 9,      // Hick's law bound
  maxNestingDepth: 6,            // max nesting depth
  refElementCount: 30,           // reference element count
  refNestingDepth: 6,            // reference nesting depth
});
```

---

## 🧪 Testing

```bash
npm test                # Run all tests
npm run test:coverage   # With coverage
npm run test:kpi        # KPI dashboard
npm run test:watch      # Watch mode
```

### Test Results

```
Test Files  13 passed (13)
     Tests  84 passed (84)
  Duration  1.01s
```

---

## 🔬 Research Foundation

- Reinecke et al. (CHI 2013) — ~50% variance in aesthetic appeal at 500ms
- Ngo, Teo & Byrne (2003) — 14 computational layout measures
- Birkhoff (1933) — Aesthetic Measure M = O/C
- Hasler & Süsstrunk (2003) — Colorfulness metric
- Rosenholtz et al. (2005, 2007) — Visual clutter (Feature Congestion)
- WCAG 2.1/2.2 — Accessibility contrast requirements
- APCA — Perceptual contrast (advisory)
- Hick-Hyman, Fitts, Miller — Cognitive load bounds

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Ngo et al. (2003)](https://doi.org/10.1016/S0020-0255(02)00404-8) — Modelling interface aesthetics
- [Reinecke et al. (2013)](https://doi.org/10.1145/2470654.2481282) — Predicting first impressions
- [W3C WCAG 2.1/2.2](https://www.w3.org/WAI/standards-guidelines/wcag/) — Accessibility standards

---

<div align="center">

**Built with ❤️ for deterministic design quality**

[Report Bug](https://github.com/akaradje/cybernetic-design-system/issues) · [Request Feature](https://github.com/akaradje/cybernetic-design-system/issues) · [Documentation](docs/ARCHITECTURE.md)

</div>
]]>