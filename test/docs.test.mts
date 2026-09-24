/**
 * Keeps docs/RUNBOOK.md the complete reference for npm scripts and test files: adding either without
 * documenting it fails CI, so the runbook can't silently fall behind.
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> };
const runbook = await readFile('docs/RUNBOOK.md', 'utf8');

/** `npm start` / `npm test` are shorthands npm provides; everything else is invoked via `npm run`. */
const invocation = (name: string): string => (name === 'start' || name === 'test' ? `npm ${name}` : `npm run ${name}`);

describe('docs/RUNBOOK.md', () => {
  it('documents every npm script in its scripts table', () => {
    const missing = Object.keys(pkg.scripts).filter((name) => !runbook.includes(`| \`${invocation(name)}\` |`));
    assert.deepEqual(missing, [], 'add a row to RUNBOOK.md §2 for each of these scripts');
  });

  it('documents every test file in its test suites table', async () => {
    const files = (await readdir('test')).filter((f) => f.endsWith('.test.mts'));
    const missing = files.filter((f) => !runbook.includes(`| \`test/${f}\` |`));
    assert.deepEqual(missing, [], 'add a row to RUNBOOK.md §6 for each of these test files');
  });
});
