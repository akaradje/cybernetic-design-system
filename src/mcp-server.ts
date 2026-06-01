#!/usr/bin/env node
/**
 * CDS MCP Server — exposes Cybernetic Design System as MCP tools for Claude Code.
 *
 * Tools:
 *   cds-analyze     — static analysis (report + metrics + violations)
 *   cds-fix         — analyze + auto-fix grid violations
 *   cds-cbir        — CBIR refinement loop until convergence
 *   cds-agents      — agent orchestration (semantic + aesthetic behind the cage)
 *   cds-check-file  — analyze file on disk, optionally write fixes back
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { analyze, fix, cbir, orchestrate, DEFAULT_CONFIG } from './index.js';
import type { DesignConfig } from './config/tokens.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mergeConfig(partial: Record<string, unknown> | undefined): DesignConfig {
  if (!partial) return DEFAULT_CONFIG;
  const cfg: DesignConfig = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(cfg) as (keyof DesignConfig)[]) {
    if (key in partial && typeof partial[key] === 'number') {
      (cfg as any)[key] = partial[key];
    }
  }
  return cfg;
}

function textContent(text: string) {
  return { type: 'text' as const, text };
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'cds',
  version: '0.1.0',
});

// Type-safe wrapper for tool registration
function registerTool(
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodType>,
  handler: (args: any) => Promise<{ content: { type: 'text'; text: string }[] }>,
) {
  (server as any).tool(name, description, inputSchema, handler);
}

// ── Tool: cds-analyze ────────────────────────────────────────────────────────

registerTool(
  'cds-analyze',
  'Run CDS static analysis on TSX/JSX source code. Returns design quality report with metrics, violations, and suggestions.',
  {
    code: z.string().describe('TSX/JSX source code to analyze'),
    config: z.record(z.string(), z.unknown()).optional().describe('Optional config overrides (minContrast, idealDistinctColors, etc.)'),
  } as any,
  async ({ code, config }: { code: string; config?: Record<string, unknown> }) => {
    const cfg = mergeConfig(config);
    const result = analyze(code, cfg);
    return { content: [textContent(result.report)] };
  },
);

// ── Tool: cds-fix ────────────────────────────────────────────────────────────

registerTool(
  'cds-fix',
  'Run CDS analysis and auto-fix grid/spacing violations. Returns the fixed source code plus the full report.',
  {
    code: z.string().describe('TSX/JSX source code to fix'),
    config: z.record(z.string(), z.unknown()).optional().describe('Optional config overrides'),
  } as any,
  async ({ code, config }: { code: string; config?: Record<string, unknown> }) => {
    const cfg = mergeConfig(config);
    const { code: fixedCode, result } = fix(code, cfg);
    const output = [
      '## Fixed Code',
      '```tsx',
      fixedCode,
      '```',
      '',
      '## Analysis Report',
      result.report,
    ].join('\n');
    return { content: [textContent(output)] };
  },
);

// ── Tool: cds-cbir ───────────────────────────────────────────────────────────

registerTool(
  'cds-cbir',
  'Run CBIR (Constraint-Bounded Iterative Refinement) loop on TSX/JSX source. Iteratively refines until convergence or max iterations.',
  {
    code: z.string().describe('TSX/JSX source code to refine'),
    config: z.record(z.string(), z.unknown()).optional().describe('Optional config overrides'),
  } as any,
  async ({ code, config }: { code: string; config?: Record<string, unknown> }) => {
    const cfg = mergeConfig(config);
    const result = cbir(code, cfg);
    const L: string[] = [];
    L.push(`CBIR refinement — converged in ${result.iterations} iterations`);
    L.push(`cost J: ${result.improvement > 0 ? `${result.improvement.toFixed(3)} improvement` : 'no improvement'}`);
    L.push(`final J=${result.finalCost}   passed=${result.passed}`);
    if (result.fixes.length) {
      L.push(`fixes applied (${result.fixes.length}):`);
      for (const f of result.fixes) L.push(`  ✓ ${f.before} -> ${f.after}  (${f.reason})`);
    }
    if (result.suggestions.length) {
      L.push(`suggestions:`);
      for (const s of result.suggestions) L.push(`  → ${s}`);
    }
    L.push('');
    L.push('## Refined Code');
    L.push('```tsx');
    L.push(result.code);
    L.push('```');
    return { content: [textContent(L.join('\n'))] };
  },
);

// ── Tool: cds-agents ─────────────────────────────────────────────────────────

registerTool(
  'cds-agents',
  'Run CDS agent orchestration (semantic + aesthetic agents behind the cage). Agents propose token changes; the cage validates each proposal.',
  {
    code: z.string().describe('TSX/JSX source code to refine with agents'),
    config: z.record(z.string(), z.unknown()).optional().describe('Optional config overrides'),
  } as any,
  async ({ code, config }: { code: string; config?: Record<string, unknown> }) => {
    const cfg = mergeConfig(config);
    const result = orchestrate(code, cfg);
    const L: string[] = [];
    L.push(`Agent orchestration — ${result.acceptedCount} accepted, ${result.rejectedCount} rejected`);
    L.push(`cost J: ${result.improvement > 0 ? `${result.improvement.toFixed(3)} improvement` : 'no improvement'}`);
    L.push(`final J=${result.finalCost}`);
    if (result.proposals.length) {
      L.push(`proposals (${result.proposals.length}):`);
      for (let i = 0; i < result.proposals.length; i++) {
        const p = result.proposals[i];
        const cr = result.cageResults[i];
        const status = cr?.accepted ? '✓ accepted' : `✗ rejected: ${cr?.rejectionReason}`;
        L.push(`  [${p.operator}] ${p.reason} — ${status}`);
      }
    }
    if (result.fixes.length) {
      L.push(`fixes applied (${result.fixes.length}):`);
      for (const f of result.fixes) L.push(`  ✓ ${f.before} -> ${f.after}  (${f.reason})`);
    }
    L.push('');
    L.push('## Refined Code');
    L.push('```tsx');
    L.push(result.code);
    L.push('```');
    return { content: [textContent(L.join('\n'))] };
  },
);

// ── Tool: cds-check-file ─────────────────────────────────────────────────────

registerTool(
  'cds-check-file',
  'Analyze a TSX/JSX file on disk. Optionally write auto-fixes back to the file.',
  {
    filePath: z.string().describe('Absolute path to the .tsx/.jsx file'),
    fix: z.boolean().optional().describe('Write auto-fixes back to the file (default: false)'),
    config: z.record(z.string(), z.unknown()).optional().describe('Optional config overrides'),
  } as any,
  async ({ filePath, fix: shouldFix, config }: { filePath: string; fix?: boolean; config?: Record<string, unknown> }) => {
    const absPath = resolve(filePath);
    const code = readFileSync(absPath, 'utf8');
    const cfg = mergeConfig(config);

    if (shouldFix) {
      const { code: fixedCode, result } = fix(code, cfg);
      if (fixedCode !== code) {
        writeFileSync(absPath, fixedCode, 'utf8');
      }
      return { content: [textContent(`File: ${absPath}\n${result.report}`)] };
    }

    const result = analyze(code, cfg);
    return { content: [textContent(`File: ${absPath}\n${result.report}`)] };
  },
);

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CDS MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in CDS MCP server:', error);
  process.exit(1);
});
