import { describe, it, expect } from 'vitest';
import { perceive, irToState } from '../../../src/layers/perception';
import { CLEAN_CODE, DIRTY_CODE } from '../../setup';

describe('perception', () => {
  it('returns valid DesignIR for clean code', () => {
    const ir = perceive(CLEAN_CODE);

    expect(ir.frame).toHaveProperty('w');
    expect(ir.frame).toHaveProperty('h');
    expect(Array.isArray(ir.nodes)).toBe(true);
    expect(ir.nodes.length).toBeGreaterThan(0);
    expect(ir.meta.rendered).toBe(false);
  });

  it('assigns sequential IDs to nodes', () => {
    const ir = perceive(DIRTY_CODE);
    for (let i = 0; i < ir.nodes.length; i++) {
      expect(ir.nodes[i].id).toBe(`n${i}`);
    }
  });

  it('detects interactive elements', () => {
    const ir = perceive(DIRTY_CODE);
    const interactive = ir.nodes.filter((n) => n.interactive);
    expect(interactive.length).toBeGreaterThan(0);
  });

  it('extracts parent references', () => {
    const ir = perceive(DIRTY_CODE);
    const root = ir.nodes.find((n) => n.parent === null);
    expect(root).toBeTruthy();
  });

  it('derives semantic roles', () => {
    const ir = perceive(DIRTY_CODE);
    const buttons = ir.nodes.filter((n) => n.role === 'button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('builds token usage', () => {
    const ir = perceive(DIRTY_CODE);
    expect(ir.tokens.colors.length).toBeGreaterThan(0);
    expect(ir.tokens.spacing.length).toBeGreaterThan(0);
  });

  it('builds source map', () => {
    const ir = perceive(DIRTY_CODE);
    expect(ir.source.classSites.length).toBeGreaterThan(0);
  });

  describe('irToState', () => {
    it('derives legacy DesignState from IR', () => {
      const ir = perceive(CLEAN_CODE);
      const state = irToState(ir);

      expect(state.elements.length).toBe(ir.nodes.length);
      expect(state.allClasses.length).toBeGreaterThan(0);
      expect(state.classNameSites.length).toBe(ir.source.classSites.length);
    });
  });
});
