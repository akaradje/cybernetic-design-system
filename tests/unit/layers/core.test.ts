import { describe, it, expect } from 'vitest';
import { computeMetrics, checkConstraints, refine } from '../../../src/layers/core';
import { perceive } from '../../../src/layers/perception';
import { DEFAULT_CONFIG } from '../../../src/config/tokens';
import { CLEAN_CODE, DIRTY_CODE } from '../../setup';

describe('core', () => {
  describe('computeMetrics', () => {
    it('returns valid metrics for clean code', () => {
      const ir = perceive(CLEAN_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);

      expect(metrics.contrast).toBeDefined();
      expect(metrics.apca).toBeDefined();
      expect(metrics.birkhoff).toBeDefined();
      expect(metrics.ngo14).toBeDefined();
      expect(metrics.density).toBeDefined();
      expect(metrics.gridAdherence).toBeGreaterThanOrEqual(0);
      expect(metrics.gridAdherence).toBeLessThanOrEqual(1);
      expect(metrics.cost).toBeGreaterThanOrEqual(0);
    });

    it('cost is higher for dirty code', () => {
      const cleanIR = perceive(CLEAN_CODE);
      const dirtyIR = perceive(DIRTY_CODE);
      const cleanCost = computeMetrics(cleanIR, DEFAULT_CONFIG).cost;
      const dirtyCost = computeMetrics(dirtyIR, DEFAULT_CONFIG).cost;

      expect(dirtyCost).toBeGreaterThanOrEqual(cleanCost);
    });
  });

  describe('checkConstraints', () => {
    it('detects grid violations in dirty code', () => {
      const ir = perceive(DIRTY_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const violations = checkConstraints(ir, metrics, DEFAULT_CONFIG);

      const gridViolations = violations.filter((v) => v.rule === 'grid.spacing');
      expect(gridViolations.length).toBeGreaterThan(0);
    });

    it('detects contrast violations in dirty code', () => {
      const ir = perceive(DIRTY_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const violations = checkConstraints(ir, metrics, DEFAULT_CONFIG);

      const contrastViolations = violations.filter((v) => v.rule === 'a11y.contrast');
      expect(contrastViolations.length).toBeGreaterThan(0);
    });

    it('clean code has fewer violations', () => {
      const cleanIR = perceive(CLEAN_CODE);
      const dirtyIR = perceive(DIRTY_CODE);
      const cleanViolations = checkConstraints(cleanIR, computeMetrics(cleanIR, DEFAULT_CONFIG), DEFAULT_CONFIG);
      const dirtyViolations = checkConstraints(dirtyIR, computeMetrics(dirtyIR, DEFAULT_CONFIG), DEFAULT_CONFIG);

      expect(cleanViolations.length).toBeLessThanOrEqual(dirtyViolations.length);
    });
  });

  describe('refine', () => {
    it('produces edits for off-grid spacing', () => {
      const ir = perceive(DIRTY_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const result = refine(ir, metrics, DEFAULT_CONFIG);

      expect(result.edits.size).toBeGreaterThan(0);
      expect(result.fixes.length).toBeGreaterThan(0);
    });

    it('produces suggestions for failing contrast', () => {
      const ir = perceive(DIRTY_CODE);
      const metrics = computeMetrics(ir, DEFAULT_CONFIG);
      const result = refine(ir, metrics, DEFAULT_CONFIG);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
