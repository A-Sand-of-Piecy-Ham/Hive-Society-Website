/**
 * CI gate for content/theme.yaml. Prints each problem with its location and exits non-zero,
 * so a bad color edit (e.g. from the CMS) fails the PR with a readable message. After the format
 * rules pass, checks WCAG contrast (src/contrast.mts); waived known failures print as warnings.
 *
 * Usage: node scripts/validate-theme.mts [path]   (default: content/theme.yaml)
 */
import { CONTRAST_WAIVERS, checkContrast, pairLabel, themeColors, themePairs, uncoveredThemeKeys } from '../src/contrast.mts';
import { loadTheme, themeToCssVariables, validateTheme } from '../src/theme.mts';

const path = process.argv[2] ?? 'content/theme.yaml';
const doc = await loadTheme(path);
const issues = validateTheme(doc);

if (issues.length > 0) {
  console.error(`${path}: ${issues.length.toString()} problem(s)`);
  for (const { path: at, message } of issues) console.error(`  ${at}: ${message}`);
  process.exitCode = 1;
} else {
  const theme = doc as Record<string, unknown>;
  const colors = themeColors(theme);
  const pairs = themePairs(theme);
  const results = checkContrast(colors, pairs);
  const problems: string[] = [];
  const warnings: string[] = [];
  for (const { pair, ratio, required } of results) {
    const label = pairLabel(pair);
    const waiver = CONTRAST_WAIVERS[label];
    if (ratio >= required) {
      if (waiver !== undefined) problems.push(`${label}: passes now (${ratio.toFixed(2)}:1); remove its waiver from src/contrast.mts`);
    } else if (waiver !== undefined) {
      warnings.push(`${label}: ${ratio.toFixed(2)}:1, needs ${required.toString()}:1 (waived: ${waiver})`);
    } else {
      problems.push(`${label}: contrast ${ratio.toFixed(2)}:1 is below ${required.toString()}:1. Darken/lighten one of the two colors.`);
    }
  }
  const labels = new Set(pairs.map(pairLabel));
  for (const label of Object.keys(CONTRAST_WAIVERS)) if (!labels.has(label)) problems.push(`waiver "${label}" matches no pair; remove it from src/contrast.mts`);
  for (const key of uncoveredThemeKeys(colors, pairs)) problems.push(`${key}: not in any contrast pair; add where it's drawn to CONTRAST_PAIRS in src/contrast.mts`);

  for (const w of warnings) console.warn(`  warning: ${w}`);
  if (problems.length > 0) {
    console.error(`${path}: ${problems.length.toString()} contrast problem(s)`);
    for (const p of problems) console.error(`  ${p}`);
    process.exitCode = 1;
  } else {
    const count = themeToCssVariables(theme).size;
    console.log(`${path}: OK (${count.toString()} colors, ${results.length.toString()} contrast pairs, ${warnings.length.toString()} waived)`);
  }
}
