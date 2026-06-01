import { parse } from '@babel/parser';
import type {
  DesignState, DesignIR, IRNode, SemanticRole, ClassNameSite, SpacingUtility, TokenUsage, SourceMap,
} from '../types';
import { COLOR_HEX } from '../config/tokens';
import { parseSpacingClass } from '../metrics/grid';

const INTERACTIVE_TAGS = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'Button', 'Link', 'Input',
]);

const TAG_ROLE_MAP: Record<string, SemanticRole> = {
  button: 'button', Button: 'button',
  a: 'link', Link: 'link',
  h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
  p: 'body', span: 'body', label: 'body',
  input: 'input', Input: 'input', select: 'input', textarea: 'input',
  nav: 'nav', Nav: 'nav',
  ul: 'list', ol: 'list', li: 'list',
  img: 'image', Img: 'image',
  div: 'container', section: 'container', main: 'container', article: 'container',
  aside: 'container', header: 'container', footer: 'container',
};

/** Resolve a color token ("slate-400") to hex from the palette. */
function resolveColor(token: string): string | null {
  return COLOR_HEX[token] ?? null;
}

function roleOf(tag: string): SemanticRole {
  return TAG_ROLE_MAP[tag] ?? 'unknown';
}

/**
 * Layer 1: turn raw UI source into a structured DesignIR. We do a generic
 * recursive AST walk (no @babel/traverse dependency) so this stays light.
 */
export function perceive(code: string): DesignIR {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const nodes: IRNode[] = [];
  let maxDepth = 0;
  const classNameSites: ClassNameSite[] = [];
  let nodeCounter = 0;

  const walk = (node: any, depth: number, parentId: string | null): void => {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'JSXElement') {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
      const tag = jsxName(node.openingElement?.name);
      const id = `n${nodeCounter++}`;
      const interactive = INTERACTIVE_TAGS.has(tag);
      const role = roleOf(tag);

      const { classes, site } = extractClassName(node.openingElement?.attributes ?? []);
      if (site) classNameSites.push(site);

      // Resolve fg/bg from classes for the style object.
      const fgCls = classes.find((c) => c.startsWith('text-'));
      const bgCls = classes.find((c) => c.startsWith('bg-'));
      const fg = fgCls ? resolveColor(fgCls.replace('text-', '')) : undefined;
      const bg = bgCls ? resolveColor(bgCls.replace('bg-', '')) : undefined;

      const irNode: IRNode = {
        id,
        parent: parentId,
        role,
        tag,
        depth,
        box: { x: 0, y: 0, w: 0, h: 0 },  // static path — no geometry
        area: 0,
        visualWeight: 1.0,
        style: { fg: fg ?? undefined, bg: bg ?? undefined },
        classes,
        interactive,
        classSite: site,
      };
      nodes.push(irNode);

      // Recurse children with this node as parent.
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (Array.isArray(val)) val.forEach((c) => walk(c, depth, id));
        else if (val && typeof val === 'object' && typeof val.type === 'string') {
          walk(val, depth, id);
        }
      }
      return; // already recursed
    }

    for (const key of Object.keys(node)) {
      const val = node[key];
      if (Array.isArray(val)) val.forEach((c) => walk(c, depth, parentId));
      else if (val && typeof val === 'object' && typeof val.type === 'string') {
        walk(val, depth, parentId);
      }
    }
  };
  walk(ast.program, 0, null);

  // Aggregate token usage.
  const allClasses = nodes.flatMap((n) => n.classes);
  const colorClasses = allClasses.filter(isKnownColorClass);
  const distinctColors = [...new Set(colorClasses.map(colorTokenOf))];

  const spacing: SpacingUtility[] = [];
  for (const n of nodes) {
    for (const cls of n.classes) {
      const p = parseSpacingClass(cls);
      if (p && p.px !== null) {
        spacing.push({
          prop: p.prop,
          rawValue: p.rawValue,
          px: p.px,
          onGrid: p.onGrid,
          classToken: p.classToken,
          elementTag: n.tag,
          site: n.classSite,
        });
      }
    }
  }

  const tokens: TokenUsage = { colors: distinctColors, spacing };
  const source: SourceMap = { classSites: classNameSites };

  return {
    frame: { w: 1440, h: 900 },  // default viewport
    nodes,
    tokens,
    source,
    meta: { dpr: 1, colorSpace: 'srgb', rendered: false },
  };
}

/**
 * Derive a legacy DesignState from a DesignIR for backward compatibility.
 * @deprecated Use DesignIR directly.
 */
export function irToState(ir: DesignIR): DesignState {
  const allClasses = ir.nodes.flatMap((n) => n.classes);
  const colorClasses = allClasses.filter(isKnownColorClass);
  const distinctColors = [...new Set(colorClasses.map(colorTokenOf))];
  const distinctSpacingPx = [...new Set(ir.tokens.spacing.map((s) => s.px))].sort((a, b) => a - b);

  return {
    elements: ir.nodes.map((n) => ({ tag: n.tag, depth: n.depth, classes: n.classes, classSite: n.classSite })),
    allClasses,
    colorClasses,
    distinctColors,
    spacing: ir.tokens.spacing,
    distinctSpacingPx,
    nestingDepth: Math.max(0, ...ir.nodes.map((n) => n.depth)),
    interactiveCount: ir.nodes.filter((n) => n.interactive).length,
    classNameSites: ir.source.classSites,
  };
}

function jsxName(name: any): string {
  if (!name) return '?';
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return `${jsxName(name.object)}.${jsxName(name.property)}`;
  return '?';
}

function extractClassName(attrs: any[]): { classes: string[]; site?: ClassNameSite } {
  for (const attr of attrs) {
    if (attr.type !== 'JSXAttribute') continue;
    const n = attr.name?.name;
    if (n !== 'className' && n !== 'class') continue;
    const v = attr.value;
    // className="..."
    if (v?.type === 'StringLiteral') {
      return {
        classes: split(v.value),
        site: { raw: v.value, start: v.start + 1, end: v.end - 1, static: true },
      };
    }
    // className={"..."}
    if (v?.type === 'JSXExpressionContainer' && v.expression?.type === 'StringLiteral') {
      const e = v.expression;
      return {
        classes: split(e.value),
        site: { raw: e.value, start: e.start + 1, end: e.end - 1, static: true },
      };
    }
    // dynamic (template literal, clsx(...), etc.) — analyze static parts, never rewrite
    if (v?.type === 'JSXExpressionContainer') {
      const statics = collectStringLiterals(v.expression);
      return { classes: statics.flatMap(split), site: undefined };
    }
  }
  return { classes: [] };
}

function collectStringLiterals(node: any, acc: string[] = []): string[] {
  if (!node || typeof node !== 'object') return acc;
  if (node.type === 'StringLiteral') acc.push(node.value);
  if (node.type === 'TemplateLiteral') node.quasis.forEach((q: any) => acc.push(q.value.cooked ?? ''));
  for (const k of Object.keys(node)) {
    const val = node[k];
    if (Array.isArray(val)) val.forEach((c) => collectStringLiterals(c, acc));
    else if (val && typeof val === 'object' && typeof val.type === 'string') {
      collectStringLiterals(val, acc);
    }
  }
  return acc;
}

const split = (s: string) => s.split(/\s+/).filter(Boolean);

function isKnownColorClass(cls: string): boolean {
  return colorTokenOf(cls) !== '';
}

function colorTokenOf(cls: string): string {
  const m = cls.match(/^(?:text|bg|border|ring|fill|stroke)-(.+)$/);
  if (!m) return '';
  return m[1] in COLOR_HEX ? m[1] : '';
}
