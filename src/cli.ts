#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { analyze, analyzeDynamic, orchestrate, DEFAULT_CONFIG } from './index';
import { cbir } from './refiners/cbir';

/**
 * Usage:
 *   cds <file.tsx>              analyze + print report (static path)
 *   cds <file.tsx> --dynamic    analyze with Playwright (computed boxes + screenshot)
 *   cds <file.tsx> --fix        write grid auto-fixes back to the file
 *   cds <file.tsx> --cbir       run CBIR loop until convergence (full refinement)
 *   cds <file.tsx> --agents     run agents behind the cage (semantic + aesthetic)
 *   cds <file.tsx> --pixel      analyze pixel art (JSON pixel grid input)
 *   cds <file.tsx> --json       machine-readable output
 *   cds <file.tsx> --strict     exit 2 if hard violations remain (blocks in a hook)
 *
 * It can also read source from stdin when no file path is given — handy for a
 * Claude Code hook that pipes the edited file's contents in.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const file = args.find((a) => !a.startsWith('--'));

  const code = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');

  if (flags.has('--cbir')) {
    // Run the full CBIR loop.
    const result = cbir(code, DEFAULT_CONFIG);
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
    if (file && result.fixes.length) {
      writeFileSync(file, result.code, 'utf8');
      L.push(`(written to ${file})`);
    }
    process.stdout.write(L.join('\n') + '\n');
    if (flags.has('--strict') && !result.passed) process.exit(2);
    process.exit(0);
  }

  if (flags.has('--agents')) {
    // Run agents behind the cage.
    process.stderr.write('Running agents (semantic + aesthetic) behind the cage...\n');
    const result = orchestrate(code, DEFAULT_CONFIG);
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
    if (file && result.fixes.length) {
      writeFileSync(file, result.code, 'utf8');
      L.push(`(written to ${file})`);
    }
    process.stdout.write(L.join('\n') + '\n');
    process.exit(0);
  }

  if (flags.has('--pixel')) {
    // Pixel-art path: analyze a JSON pixel grid.
    const { analyzePixel, savePixelPng } = require('./pixel');
    let grid;
    try {
      grid = JSON.parse(code);
    } catch {
      process.stderr.write('Error: --pixel expects JSON pixel grid input.\n');
      process.exit(1);
    }
    const result = analyzePixel(grid, DEFAULT_CONFIG);
    const outPath = file ? file.replace(/\.[^.]+$/, '-out.png') : 'pixel-out.png';
    savePixelPng(result.grid, outPath);
    process.stdout.write(result.report + '\n');
    process.stdout.write(`(output: ${outPath})\n`);
    if (flags.has('--strict') && !result.passed) process.exit(2);
    process.exit(0);
  }

  if (flags.has('--calibrate')) {
    // Calibration harness: fit weights from human ratings.
    const { calibrate, buildCalibrationReport } = require('./calibration');
    let ratings;
    try {
      ratings = JSON.parse(code);
    } catch {
      process.stderr.write('Error: --calibrate expects JSON array of ratings.\n');
      process.stderr.write('Format: [{"screenId":"a","code":"...","score":5.2,"method":"likert"},...]\n');
      process.exit(1);
    }
    const result = calibrate(ratings, DEFAULT_CONFIG);
    process.stdout.write(buildCalibrationReport(result) + '\n');
    if (flags.has('--json')) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    }
    process.exit(0);
  }

  if (flags.has('--dynamic')) {
    // Dynamic perception with Playwright.
    process.stderr.write('Launching Playwright for dynamic analysis...\n');
    const result = await analyzeDynamic(code, DEFAULT_CONFIG);

    if (flags.has('--fix') && file && result.fixes.length) {
      writeFileSync(file, result.fixedCode, 'utf8');
    }

    if (flags.has('--json')) {
      const { state, ...rest } = result;
      process.stdout.write(JSON.stringify({ ...rest, file: file ?? '<stdin>' }, null, 2) + '\n');
    } else {
      process.stdout.write(result.report + '\n');
    }
    if (flags.has('--strict') && !result.passed) process.exit(2);
    process.exit(0);
  }

  // Single-pass static analysis.
  const result = analyze(code);

  if (flags.has('--fix') && file && result.fixes.length) {
    writeFileSync(file, result.fixedCode, 'utf8');
  }

  if (flags.has('--json')) {
    const { state, ...rest } = result;
    process.stdout.write(JSON.stringify({ ...rest, file: file ?? '<stdin>' }, null, 2) + '\n');
  } else {
    process.stdout.write(result.report + '\n');
  }

  if (flags.has('--strict') && !result.passed) process.exit(2);
  process.exit(0);
}

main();
