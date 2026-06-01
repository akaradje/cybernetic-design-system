import type { Agent, AgentProposal } from './types';
import type { DesignIR } from '../types';
import { COLOR_HEX } from '../config/tokens';

/**
 * Semantic Agent — reads element role/context and proposes token intent.
 *
 * This agent understands what an element IS (a destructive action, a primary
 * CTA, a navigation link) and proposes palette changes that match the semantic
 * intent. It proposes a TOKEN CHOICE within the allowed set, never a raw value.
 *
 * Examples:
 *   - Delete button → propose danger palette (red-600, red-700)
 *   - Save button → propose primary palette (blue-600, blue-700)
 *   - Link → propose link palette (indigo-600, blue-600)
 *
 * The cage validates every proposal: Π_F + ΔJ<0 before commit.
 */

/** Semantic intent → allowed color tokens (only tokens in COLOR_HEX). */
const SEMANTIC_PALETTE: Record<string, { bg: string[]; text: string[] }> = {
  danger: {
    bg: ['red-500', 'red-600', 'red-700'],
    text: ['white'],
  },
  primary: {
    bg: ['blue-500', 'blue-600', 'blue-700', 'indigo-500', 'indigo-600'],
    text: ['white'],
  },
  success: {
    bg: ['green-500', 'green-600', 'emerald-500', 'emerald-600'],
    text: ['white'],
  },
  warning: {
    bg: ['amber-400', 'amber-500', 'amber-600'],
    text: ['white', 'slate-900', 'gray-900'],
  },
  link: {
    bg: ['white', 'transparent'],
    text: ['blue-600', 'indigo-600', 'blue-500'],
  },
  neutral: {
    bg: ['gray-200', 'slate-200', 'gray-100', 'slate-100'],
    text: ['gray-700', 'gray-800', 'gray-900', 'slate-700', 'slate-800', 'slate-900'],
  },
};

/** Heuristic: infer semantic intent from class names and tag. */
function inferIntent(classes: string[], tag: string): string | null {
  const classStr = classes.join(' ').toLowerCase();

  // Danger signals
  if (classStr.includes('delete') || classStr.includes('remove') ||
      classStr.includes('destroy') || classStr.includes('red-') ||
      (tag === 'button' && classStr.includes('bg-red'))) {
    return 'danger';
  }

  // Primary signals
  if (classStr.includes('save') || classStr.includes('submit') ||
      classStr.includes('confirm') || classStr.includes('primary') ||
      (tag === 'button' && classStr.includes('bg-blue'))) {
    return 'primary';
  }

  // Success signals
  if (classStr.includes('success') || classStr.includes('green') ||
      classStr.includes('export') || classStr.includes('download')) {
    return 'success';
  }

  // Warning signals
  if (classStr.includes('warn') || classStr.includes('amber') ||
      classStr.includes('archive') || classStr.includes('caution')) {
    return 'warning';
  }

  // Link signals
  if (tag === 'a' || classStr.includes('link') || classStr.includes('href')) {
    return 'link';
  }

  return null;
}

/** Check if a color token is accessible against a given background. */
function isAccessible(fgToken: string, bgToken: string): boolean {
  const fgHex = COLOR_HEX[fgToken];
  const bgHex = COLOR_HEX[bgToken];
  if (!fgHex || !bgHex) return false;

  // Quick contrast check using relative luminance
  const fgLum = relativeLuminance(fgHex);
  const bgLum = relativeLuminance(bgHex);
  if (fgLum === null || bgLum === null) return false;

  const [hi, lo] = fgLum >= bgLum ? [fgLum, bgLum] : [bgLum, fgLum];
  const ratio = (hi + 0.05) / (lo + 0.05);
  return ratio >= 4.5;
}

function relativeLuminance(hex: string): number | null {
  const h = hex.replace('#', '');
  if (h.length < 6) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Create a Semantic Agent that proposes palette changes based on element role.
 */
export function createSemanticAgent(): Agent {
  return {
    id: 'semantic',
    name: 'Semantic Agent',
    propose(ir: DesignIR, _code: string): AgentProposal[] {
      const proposals: AgentProposal[] = [];

      for (const node of ir.nodes) {
        if (!node.interactive) continue;

        const intent = inferIntent(node.classes, node.tag);
        if (!intent) continue;

        const palette = SEMANTIC_PALETTE[intent];
        if (!palette) continue;

        // Find current bg and text classes
        const currentBg = node.classes.find((c) => c.startsWith('bg-'));
        const currentText = node.classes.find((c) => c.startsWith('text-'));
        const currentBgToken = currentBg?.replace('bg-', '') ?? '';
        const currentTextToken = currentText?.replace('text-', '') ?? '';

        // Check if current palette matches semantic intent
        const bgMatchesIntent = palette.bg.includes(currentBgToken);
        const textMatchesIntent = palette.text.includes(currentTextToken);

        if (!bgMatchesIntent || !textMatchesIntent) {
          // Propose the first accessible combination from the semantic palette
          for (const bgToken of palette.bg) {
            for (const textToken of palette.text) {
              if (isAccessible(textToken, bgToken)) {
                const newBg = `bg-${bgToken}`;
                const newText = `text-${textToken}`;

                // Only propose if it's actually a change
                if (newBg !== currentBg || newText !== currentText) {
                  proposals.push({
                    operator: 'semanticRecolor',
                    reason: `<${node.tag}> "${intent}" intent → ${newBg} ${newText}`,
                    params: {
                      nodeId: node.id,
                      oldBg: currentBg,
                      newBg,
                      oldText: currentText,
                      newText,
                      intent,
                    },
                  });
                }
                break; // one proposal per node
              }
            }
            if (proposals.length > 0) break;
          }
        }
      }

      return proposals;
    },
  };
}
