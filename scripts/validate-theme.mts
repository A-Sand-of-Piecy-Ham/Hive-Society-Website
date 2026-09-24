/**
 * CI gate for content/theme.yaml. Prints each problem with its location and exits non-zero,
 * so a bad color edit (e.g. from the CMS) fails the PR with a readable message.
 *
 * Usage: node scripts/validate-theme.mts [path]   (default: content/theme.yaml)
 */
import { loadTheme, themeToCssVariables, validateTheme } from '../src/theme.mts';

const path = process.argv[2] ?? 'content/theme.yaml';
const doc = await loadTheme(path);
const issues = validateTheme(doc);

if (issues.length > 0) {
  console.error(`${path}: ${issues.length.toString()} problem(s)`);
  for (const { path: at, message } of issues) console.error(`  ${at}: ${message}`);
  process.exitCode = 1;
} else {
  const count = themeToCssVariables(doc as Record<string, unknown>).size;
  console.log(`${path}: OK (${count.toString()} colors)`);
}
