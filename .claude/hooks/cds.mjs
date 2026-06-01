#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook.
 * Reads the tool event JSON from stdin, and if Claude just wrote/edited a
 * .tsx/.jsx file, runs the Cybernetic Design System on it with --fix.
 * The report is surfaced back to Claude via stderr.
 *
 * Wire it up in .claude/settings.json (see README "Claude Code integration").
 */
import { spawnSync } from 'node:child_process';

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    filePath = JSON.parse(raw)?.tool_input?.file_path ?? '';
  } catch {
    process.exit(0);
  }
  if (!/\.(tsx|jsx)$/.test(filePath)) process.exit(0);

  // Use node dist/cli.js directly since cds isn't linked globally.
  const r = spawnSync('node', ['dist/cli.js', filePath, '--fix'], { encoding: 'utf8', cwd: process.cwd() });
  if (r.stdout) process.stderr.write(r.stdout); // visible to Claude as context
  process.exit(0); // informational; auto-fix already applied
});
