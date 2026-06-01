import type { DesignIR, NGO14Result } from '../types';
import type { DesignConfig } from '../config/tokens';

/**
 * Ngo et al. (2003) — 14 computational measures for screen layout.
 * Each normalized to [0, 1], 1 = best.
 *
 * In the static path (no rendered geometry), we derive heuristics from:
 *   - Element count, depth, and class data
 *   - Token usage (colors, spacing)
 *   - The IR's structural properties
 *
 * When dynamic perception is available (boxes filled), these become precise.
 */

const PROPORTION_REFS = [1, 1.414, 1.5, 1.618, 1.732]; // reference ratios

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * M2.1 Ngo 14 measures — returns all 14 as a typed result.
 */
export function ngo14(ir: DesignIR, cfg: DesignConfig): NGO14Result {
  const n = ir.nodes.length;
  if (n === 0) {
    return {
      balance: 1, equilibrium: 1, symmetry: 1, sequence: 1,
      cohesion: 1, unity: 1, proportion: 1, simplicity: 1,
      density: 1, regularity: 1, economy: 1, homogeneity: 1,
      rhythm: 1, order: 1,
    };
  }

  // ── Static-path heuristics ──
  // Without rendered boxes, we approximate from structural properties.

  // Balance: how evenly distributed are elements across depth levels?
  const depthCounts = new Map<number, number>();
  for (const node of ir.nodes) {
    depthCounts.set(node.depth, (depthCounts.get(node.depth) ?? 0) + 1);
  }
  const depthValues = [...depthCounts.values()];
  const maxDepthCount = Math.max(...depthValues);
  const balance = clamp01(1 - (maxDepthCount - n / depthValues.length) / n);

  // Equilibrium: center of mass approximation (depth-based)
  const avgDepth = ir.nodes.reduce((s, nd) => s + nd.depth, 0) / n;
  const maxDepth = Math.max(...ir.nodes.map((nd) => nd.depth));
  const equilibrium = clamp01(1 - Math.abs(avgDepth / maxDepth - 0.5) * 2);

  // Symmetry: how balanced is the tree structure?
  const symmetry = computeTreeSymmetry(ir);

  // Sequence: reading order consistency (depth-first = natural reading order)
  const sequence = clamp01(1 - computeSequenceDisorder(ir) / n);

  // Cohesion: consistency of class usage across same-role elements
  const cohesion = computeCohesion(ir);

  // Unity: form unity (few distinct class sets) + space unity (consistent spacing)
  const unity = computeUnity(ir, cfg);

  // Proportion: how close are aspect ratios to reference set?
  const proportion = computeProportion(ir);

  // Simplicity: fewer alignment lines = simpler
  const simplicity = computeSimplicity(ir);

  // Density: area fill ratio (heuristic from class density)
  const density = computeDensity(ir);

  // Regularity: alignment + spacing regularity
  const regularity = computeRegularity(ir);

  // Economy: penalize many distinct element sizes
  const economy = computeEconomy(ir);

  // Homogeneity: even distribution across quadrants (heuristic)
  const homogeneity = computeHomogeneity(ir);

  // Rhythm: regularity of variation in position and size
  const rhythm = computeRhythm(ir);

  // Order: average of all 13 measures
  const measures = [balance, equilibrium, symmetry, sequence, cohesion, unity,
    proportion, simplicity, density, regularity, economy, homogeneity, rhythm];
  const order = round(measures.reduce((s, m) => s + m, 0) / measures.length);

  return {
    balance: round(balance),
    equilibrium: round(equilibrium),
    symmetry: round(symmetry),
    sequence: round(sequence),
    cohesion: round(cohesion),
    unity: round(unity),
    proportion: round(proportion),
    simplicity: round(simplicity),
    density: round(density),
    regularity: round(regularity),
    economy: round(economy),
    homogeneity: round(homogeneity),
    rhythm: round(rhythm),
    order: round(order),
  };
}

/** Tree symmetry: how balanced is the element tree? */
function computeTreeSymmetry(ir: DesignIR): number {
  const maxDepth = Math.max(...ir.nodes.map((n) => n.depth));
  if (maxDepth <= 1) return 1;

  // Count nodes per depth level
  const levelCounts: number[] = [];
  for (let d = 1; d <= maxDepth; d++) {
    levelCounts.push(ir.nodes.filter((n) => n.depth === d).length);
  }

  // Symmetry = how close is the distribution to being mirrored
  const maxCount = Math.max(...levelCounts);
  if (maxCount === 0) return 1;

  const variance = levelCounts.reduce((s, c) => s + Math.pow(c / maxCount - 1, 2), 0) / levelCounts.length;
  return clamp01(1 - variance);
}

/** Sequence disorder: how much does the node order deviate from depth-first? */
function computeSequenceDisorder(ir: DesignIR): number {
  let disorder = 0;
  for (let i = 1; i < ir.nodes.length; i++) {
    const prev = ir.nodes[i - 1];
    const curr = ir.nodes[i];
    // If we go from a deeper node to a shallower one, it's a "jump"
    if (curr.depth < prev.depth - 1) disorder += prev.depth - curr.depth - 1;
  }
  return disorder;
}

/** Cohesion: consistency of class usage across same-role elements. */
function computeCohesion(ir: DesignIR): number {
  const roleGroups = new Map<string, string[][]>();
  for (const node of ir.nodes) {
    if (!roleGroups.has(node.role)) roleGroups.set(node.role, []);
    roleGroups.get(node.role)!.push(node.classes);
  }

  let totalSimilarity = 0;
  let pairCount = 0;

  for (const [, classSets] of roleGroups) {
    if (classSets.length < 2) continue;
    for (let i = 0; i < classSets.length; i++) {
      for (let j = i + 1; j < classSets.length; j++) {
        const union = new Set([...classSets[i], ...classSets[j]]);
        const intersection = classSets[i].filter((c) => classSets[j].includes(c));
        totalSimilarity += union.size > 0 ? intersection.length / union.size : 1;
        pairCount++;
      }
    }
  }

  return pairCount > 0 ? clamp01(totalSimilarity / pairCount) : 1;
}

/** Unity: form unity + space unity. */
function computeUnity(ir: DesignIR, cfg: DesignConfig): number {
  // Form unity: few distinct class sets relative to n
  const classSets = ir.nodes.map((n) => n.classes.join(' '));
  const distinctSets = new Set(classSets).size;
  const formUnity = clamp01(1 - (distinctSets - 1) / Math.max(1, ir.nodes.length - 1));

  // Space unity: consistency of spacing values
  const spacing = ir.tokens.spacing;
  const distinctSpacing = new Set(spacing.map((s) => s.px)).size;
  const spaceUnity = clamp01(1 - Math.max(0, distinctSpacing - cfg.idealDistinctSpacing) / cfg.idealDistinctSpacing);

  return (formUnity + spaceUnity) / 2;
}

/** Proportion: closeness of element aspect ratios to reference set. */
function computeProportion(ir: DesignIR): number {
  // In static path, we don't have real boxes, so use depth as a proxy
  // Deeper elements are typically smaller (nested containers)
  const maxDepth = Math.max(...ir.nodes.map((n) => n.depth));
  if (maxDepth <= 1) return 1;

  // Check how well depth distribution follows a proportional scale
  const depthRatios: number[] = [];
  for (let d = 2; d <= maxDepth; d++) {
    const parentCount = ir.nodes.filter((n) => n.depth === d - 1).length;
    const childCount = ir.nodes.filter((n) => n.depth === d).length;
    if (parentCount > 0) depthRatios.push(childCount / parentCount);
  }

  if (depthRatios.length === 0) return 1;

  // How close are these ratios to reference proportions?
  const closeness = depthRatios.map((r) => {
    const minDist = Math.min(...PROPORTION_REFS.map((ref) => Math.abs(r - ref)));
    return clamp01(1 - minDist);
  });

  return clamp01(closeness.reduce((s, c) => s + c, 0) / closeness.length);
}

/** Simplicity: fewer alignment lines = simpler. */
function computeSimplicity(ir: DesignIR): number {
  // In static path, approximate by distinct class patterns
  const classPatterns = new Set(ir.nodes.map((n) => n.classes.join(' ')));
  const n = ir.nodes.length;
  // Simplicity = 3 / (distinct patterns + n) — Ngo's formula adapted
  return clamp01(3 / (classPatterns.size + n));
}

/** Density: area fill ratio heuristic. */
function computeDensity(ir: DesignIR): number {
  // Heuristic: ratio of leaf nodes to total nodes
  const parentIds = new Set(ir.nodes.filter((n) => n.parent !== null).map((n) => n.parent));
  const leafCount = ir.nodes.filter((n) => !parentIds.has(n.id)).length;
  const fillRatio = leafCount / ir.nodes.length;
  // Peak at ~50% fill (Ngo's formula)
  return clamp01(1 - Math.abs(2 * fillRatio - 1));
}

/** Regularity: alignment + spacing regularity. */
function computeRegularity(ir: DesignIR): number {
  // Alignment regularity: how few distinct depth values?
  const distinctDepths = new Set(ir.nodes.map((n) => n.depth)).size;
  const maxDepth = Math.max(...ir.nodes.map((n) => n.depth));
  const alignmentRegularity = maxDepth > 0 ? clamp01(1 - (distinctDepths - 1) / maxDepth) : 1;

  // Spacing regularity: how few distinct spacing values?
  const distinctSpacing = new Set(ir.tokens.spacing.map((s) => s.px)).size;
  const totalSpacing = ir.tokens.spacing.length || 1;
  const spacingRegularity = clamp01(1 - (distinctSpacing - 1) / totalSpacing);

  return (alignmentRegularity + spacingRegularity) / 2;
}

/** Economy: penalize many distinct element sizes. */
function computeEconomy(ir: DesignIR): number {
  // In static path, use distinct class sets as proxy for distinct sizes
  const distinctSizes = new Set(ir.nodes.map((n) => n.classes.join(' '))).size;
  return clamp01(1 / distinctSizes);
}

/** Homogeneity: even distribution across quadrants. */
function computeHomogeneity(ir: DesignIR): number {
  // Heuristic: distribute by depth into 4 quadrants
  const maxDepth = Math.max(...ir.nodes.map((n) => n.depth));
  if (maxDepth <= 1) return 1;

  const quadrants = [0, 0, 0, 0];
  for (const node of ir.nodes) {
    const qi = Math.min(3, Math.floor((node.depth / maxDepth) * 4));
    quadrants[qi]++;
  }

  const ideal = ir.nodes.length / 4;
  const deviation = quadrants.reduce((s, q) => s + Math.abs(q - ideal), 0) / ir.nodes.length;
  return clamp01(1 - deviation);
}

/** Rhythm: regularity of variation in position and size. */
function computeRhythm(ir: DesignIR): number {
  // In static path, measure rhythm by depth variation regularity
  const depths = ir.nodes.map((n) => n.depth);
  if (depths.length < 2) return 1;

  // Compute depth differences between consecutive nodes
  const diffs: number[] = [];
  for (let i = 1; i < depths.length; i++) {
    diffs.push(Math.abs(depths[i] - depths[i - 1]));
  }

  // Rhythm = consistency of these differences
  const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const variance = diffs.reduce((s, d) => s + Math.pow(d - avgDiff, 2), 0) / diffs.length;
  return clamp01(1 - variance / (avgDiff + 1));
}
