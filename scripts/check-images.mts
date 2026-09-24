/**
 * CI gate: every image under public/assets/images is within its class's limits in content/site.yaml →
 * image-limits (or listed as an exception with a reason), portraits and team photos are named by the
 * rules in src/images.mts, and no two files are identical.
 *
 * Usage: node scripts/check-images.mts
 */
import { readFile } from 'node:fs/promises';
import { checkImages, parseImagePolicy, scanImages } from '../src/images.mts';

const DIR = 'public/assets/images';
const policy = parseImagePolicy(await readFile('content/site.yaml', 'utf8'));
const files = await scanImages(DIR);
const problems = checkImages(files, policy);

if (problems.length > 0) {
  console.error(`${DIR}: ${problems.length.toString()} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exitCode = 1;
} else {
  const exceptions = Object.keys(policy.exceptions).length;
  console.log(`${DIR}: OK (${files.length.toString()} images, ${exceptions.toString()} exception(s))`);
}
