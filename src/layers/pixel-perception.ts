import type { DesignIR, IRNode, SemanticRole, TokenUsage, SourceMap } from '../types';

/**
 * M1 — Pixel-art perception.
 *
 * When the input is a pixel grid (H×W color matrix) rather than JSX/TSX,
 * we parse connected color regions into IR nodes. Each contiguous region
 * of the same color becomes a node with computed bounding box.
 *
 * No render needed — the geometry IS the input.
 */

/** A color in RGBA format. */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A pixel grid: H×W matrix of RGBA colors. */
export type PixelGrid = RGBA[][];

/** A connected region of same-colored pixels. */
export interface ColorRegion {
  /** Unique region ID. */
  id: string;
  /** The color of this region. */
  color: RGBA;
  /** Hex string of the color. */
  hex: string;
  /** All pixel positions [y, x] in this region. */
  pixels: [number, number][];
  /** Bounding box. */
  box: { x: number; y: number; w: number; h: number };
  /** Area in pixels. */
  area: number;
  /** Whether this region touches the edge of the grid. */
  touchesEdge: boolean;
}

/** Convert RGBA to hex string. */
function rgbaToHex(c: RGBA): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}${c.a < 255 ? hex(c.a) : ''}`;
}

/** Check if two colors are equal. */
function colorEqual(a: RGBA, b: RGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/**
 * Flood-fill to find connected regions of the same color.
 * Uses 4-connectivity (up, down, left, right).
 */
function floodFill(
  grid: PixelGrid,
  visited: boolean[][],
  startY: number,
  startX: number,
): ColorRegion | null {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (startY < 0 || startY >= h || startX < 0 || startX >= w) return null;
  if (visited[startY][startX]) return null;

  const targetColor = grid[startY][startX];
  const hex = rgbaToHex(targetColor);

  // Skip transparent pixels
  if (targetColor.a === 0) {
    visited[startY][startX] = true;
    return null;
  }

  const pixels: [number, number][] = [];
  const stack: [number, number][] = [[startY, startX]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;

  while (stack.length > 0) {
    const [y, x] = stack.pop()!;
    if (y < 0 || y >= h || x < 0 || x >= w) continue;
    if (visited[y][x]) continue;
    if (!colorEqual(grid[y][x], targetColor)) continue;

    visited[y][x] = true;
    pixels.push([y, x]);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    // 4-connectivity
    stack.push([y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]);
  }

  if (pixels.length === 0) return null;

  const touchesEdge = pixels.some(([y, x]) => y === 0 || y === h - 1 || x === 0 || x === w - 1);

  return {
    id: '',
    color: targetColor,
    hex,
    pixels,
    box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    area: pixels.length,
    touchesEdge,
  };
}

/**
 * Find all connected color regions in a pixel grid.
 */
export function findRegions(grid: PixelGrid): ColorRegion[] {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (h === 0 || w === 0) return [];

  const visited: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));
  const regions: ColorRegion[] = [];
  let regionCounter = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!visited[y][x]) {
        const region = floodFill(grid, visited, y, x);
        if (region) {
          region.id = `r${regionCounter++}`;
          regions.push(region);
        }
      }
    }
  }

  return regions;
}

/**
 * Convert a hex color to the nearest Tailwind token (simplified).
 */
function nearestTailwindToken(hex: string): string {
  // Simple mapping for common pixel-art colors
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Black and white
  if (r < 30 && g < 30 && b < 30) return 'black';
  if (r > 225 && g > 225 && b > 225) return 'white';

  // Grays
  const avg = (r + g + b) / 3;
  if (Math.abs(r - avg) < 20 && Math.abs(g - avg) < 20 && Math.abs(b - avg) < 20) {
    if (avg < 60) return 'gray-900';
    if (avg < 100) return 'gray-700';
    if (avg < 150) return 'gray-500';
    if (avg < 200) return 'gray-300';
    return 'gray-100';
  }

  // Primary colors
  if (r > 150 && g < 100 && b < 100) return 'red-500';
  if (r < 100 && g > 150 && b < 100) return 'green-500';
  if (r < 100 && g < 100 && b > 150) return 'blue-500';
  if (r > 150 && g > 150 && b < 100) return 'amber-500';
  if (r > 150 && g < 100 && b > 150) return 'violet-500';
  if (r < 100 && g > 150 && b > 150) return 'emerald-500';

  return 'gray-500'; // fallback
}

/**
 * Build a DesignIR from a pixel grid.
 * Each connected color region becomes an IR node.
 */
export function perceivePixel(grid: PixelGrid): DesignIR {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const regions = findRegions(grid);

  // Convert regions to IR nodes.
  const nodes: IRNode[] = regions.map((region, i) => {
    const token = nearestTailwindToken(region.hex);
    const role: SemanticRole = 'container'; // pixel regions are containers

    return {
      id: region.id,
      parent: null, // flat structure for pixel art
      role,
      tag: 'pixel-region',
      depth: 1,
      box: { x: region.box.x, y: region.box.y, w: region.box.w, h: region.box.h },
      area: region.area,
      visualWeight: region.area,
      style: {
        bg: region.hex,
      },
      classes: [`bg-${token}`],
      interactive: false,
    };
  });

  // Build token usage.
  const distinctColors = [...new Set(regions.map((r) => nearestTailwindToken(r.hex)))];
  const tokens: TokenUsage = {
    colors: distinctColors,
    spacing: [], // pixel art has no spacing utilities
  };

  const source: SourceMap = { classSites: [] }; // no source spans for pixel art

  return {
    frame: { w, h },
    nodes,
    tokens,
    source,
    meta: { dpr: 1, colorSpace: 'srgb', rendered: true }, // already "rendered"
  };
}

/**
 * Create a pixel grid from a simple string representation.
 * Each character maps to a color. Useful for testing.
 *
 * Example:
 *   parsePixelMap(`
 *     ..RR..
 *     ..RR..
 *     BBBBBB
 *   `, { R: {r:255,g:0,b:0,a:255}, B: {r:0,g:0,b:255,a:255} })
 */
export function parsePixelMap(
  map: string,
  palette: Record<string, RGBA>,
): PixelGrid {
  const lines = map.trim().split('\n').map((l) => l.trim());
  const h = lines.length;
  const w = Math.max(...lines.map((l) => l.length));

  const transparent: RGBA = { r: 0, g: 0, b: 0, a: 0 };

  return lines.map((line) => {
    const row: RGBA[] = [];
    for (let x = 0; x < w; x++) {
      const ch = x < line.length ? line[x] : '.';
      row.push(palette[ch] ?? transparent);
    }
    return row;
  });
}
