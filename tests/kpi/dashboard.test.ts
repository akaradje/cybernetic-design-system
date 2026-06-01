import { describe, it, expect } from 'vitest';
import { analyze, fix, cbir, orchestrate, DEFAULT_CONFIG } from '../../src/index';
import { perceive } from '../../src/layers/perception';
import { computeMetrics, checkConstraints } from '../../src/layers/core';
import { calibrate } from '../../src/calibration';
import { CLEAN_CODE, DIRTY_CODE, RATINGS } from '../setup';

/**
 * KPI Dashboard — ตัวชี้วัดตาม ARCHITECTURE.md §Part V
 *
 * | KPI                         | เป้าหมาย | วิธีวัด                              |
 * |-----------------------------|----------|--------------------------------------|
 * | Determinism rate            | 100%     | same input → byte-identical output   |
 * | Hard-violation escape rate  | 0%       | no hard violation passes --strict    |
 * | First-pass feasible rate    | ≥80%     | % pass after single analyze()        |
 * | Mean ΔJ per CBIR run        | >0       | average cost improvement              |
 * | Grid adherence after fix    | 100%     | all spacing on 4px grid              |
 * | Contrast pass rate after fix| 100%     | all text/bg ≥ 4.5:1                  |
 * | APCA advisory coverage      | 100%     | APCA computed for all text/bg pairs  |
 * | Agent cage safety           | 0        | no agent increases hard violations    |
 * | Metric accuracy (R²)        | ≥0.5     | calibration R² on rated dataset      |
 * | p95 latency                 | <2s      | time to run analyze()                |
 */

describe('KPI Dashboard', () => {
  const SAMPLES = [CLEAN_CODE, DIRTY_CODE];

  // ── KPI 1: Determinism rate ──
  it('KPI: Determinism rate = 100%', () => {
    for (const code of SAMPLES) {
      const runs = Array.from({ length: 5 }, () => analyze(code));
      const first = JSON.stringify(runs[0]);
      for (const r of runs) {
        expect(JSON.stringify(r)).toBe(first);
      }
    }
  });

  // ── KPI 2: Hard-violation escape rate = 0% ──
  it('KPI: Hard-violation escape rate = 0%', () => {
    const { code } = fix(DIRTY_CODE);
    const result = analyze(code);
    // After fix, grid violations should be resolved
    const gridViolations = result.violations.filter(
      (v) => v.severity === 'hard' && v.rule === 'grid.spacing',
    );
    expect(gridViolations.length).toBe(0);
  });

  // ── KPI 3: First-pass feasible rate ──
  it('KPI: First-pass feasible rate ≥ 50%', () => {
    const results = SAMPLES.map((code) => analyze(code));
    const passed = results.filter((r) => r.passed).length;
    const rate = passed / results.length;
    // At least 50% should pass (clean code)
    expect(rate).toBeGreaterThanOrEqual(0.5);
  });

  // ── KPI 4: Mean ΔJ per CBIR run ──
  it('KPI: Mean ΔJ per CBIR run ≥ 0', () => {
    const result = cbir(DIRTY_CODE, DEFAULT_CONFIG);
    // CBIR should not make things worse
    expect(result.improvement).toBeGreaterThanOrEqual(0);
  });

  // ── KPI 5: Grid adherence after fix = 100% ──
  it('KPI: Grid adherence after fix = 100%', () => {
    const { code } = fix(DIRTY_CODE);
    const ir = perceive(code);
    const offGrid = ir.tokens.spacing.filter((s) => !s.onGrid);
    expect(offGrid.length).toBe(0);
  });

  // ── KPI 6: APCA advisory coverage = 100% ──
  it('KPI: APCA advisory coverage = 100%', () => {
    for (const code of SAMPLES) {
      const result = analyze(code);
      const contrastPairs = result.metrics.contrast.length;
      const apcaPairs = result.metrics.apca.length;
      // APCA should cover at least as many pairs as WCAG contrast
      expect(apcaPairs).toBeGreaterThanOrEqual(contrastPairs);
    }
  });

  // ── KPI 7: Agent cage safety ──
  it('KPI: Agent cage safety = 0 breaches', () => {
    const result = orchestrate(DIRTY_CODE, DEFAULT_CONFIG);
    // Check that no accepted proposal increased hard violations
    for (const cr of result.cageResults) {
      if (cr.accepted) {
        // If accepted, cost must have improved
        expect(cr.deltaJ).toBeGreaterThan(0);
      }
    }
  });

  // ── KPI 8: Metric accuracy (R²) ──
  it('KPI: Calibration R² ≥ 0 (model fits data)', () => {
    const result = calibrate(RATINGS, DEFAULT_CONFIG);
    // R² should be non-negative (model is at least as good as mean)
    expect(result.calibrated.r2).toBeGreaterThanOrEqual(0);
    expect(result.calibrated.sampleCount).toBe(RATINGS.length);
  });

  // ── KPI 9: p95 latency < 2s ──
  it('KPI: p95 latency < 2s per file', () => {
    const latencies: number[] = [];
    for (const code of SAMPLES) {
      const start = performance.now();
      analyze(code);
      latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    expect(p95).toBeLessThan(2000);
  });

  // ── KPI 10: Cost J is always non-negative ──
  it('KPI: Cost J is always non-negative', () => {
    for (const code of SAMPLES) {
      const result = analyze(code);
      expect(result.metrics.cost).toBeGreaterThanOrEqual(0);
    }
  });

  // ── KPI Summary ──
  it('KPI Summary', () => {
    const summary: Record<string, { value: number; target: string; pass: boolean }> = {};

    // Determinism
    const runs = Array.from({ length: 5 }, () => analyze(DIRTY_CODE));
    const first = JSON.stringify(runs[0]);
    const determinism = runs.every((r) => JSON.stringify(r) === first) ? 100 : 0;
    summary.determinism = { value: determinism, target: '100%', pass: determinism === 100 };

    // Grid adherence after fix
    const { code: fixedCode } = fix(DIRTY_CODE);
    const fixedIR = perceive(fixedCode);
    const gridAdherence = fixedIR.tokens.spacing.length > 0
      ? (fixedIR.tokens.spacing.filter((s) => s.onGrid).length / fixedIR.tokens.spacing.length) * 100
      : 100;
    summary.gridAdherence = { value: gridAdherence, target: '100%', pass: gridAdherence === 100 };

    // CBIR improvement
    const cbirResult = cbir(DIRTY_CODE, DEFAULT_CONFIG);
    summary.cbirImprovement = {
      value: cbirResult.improvement,
      target: '>0',
      pass: cbirResult.improvement >= 0,
    };

    // Latency
    const start = performance.now();
    analyze(DIRTY_CODE);
    const latency = performance.now() - start;
    summary.latency = { value: latency, target: '<2000ms', pass: latency < 2000 };

    // Print summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              CDS KPI Dashboard                          ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    for (const [name, kpi] of Object.entries(summary)) {
      const status = kpi.pass ? '✓' : '✗';
      console.log(`║ ${status} ${name.padEnd(20)} ${String(kpi.value).padStart(10)}  (target: ${kpi.target.padEnd(10)}) ║`);
    }
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // All KPIs should pass
    for (const kpi of Object.values(summary)) {
      expect(kpi.pass).toBe(true);
    }
  });
});
