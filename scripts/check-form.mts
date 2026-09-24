/**
 * Drift check between content/site.yaml and the live Google Form behind the mailing list.
 * Network-dependent, so it runs on a schedule (and on PRs touching site.yaml), not as a required check.
 *
 * Usage: node scripts/check-form.mts
 */
import { formDrift, googleFormUrl, parseGoogleForm } from '../src/forms.mts';
import { loadSite } from '../src/site.mts';

const { mailingList } = await loadSite();
const url = googleFormUrl(mailingList.googleFormId);
const res = await fetch(url);
if (!res.ok) throw new Error(`Fetching ${url} failed: HTTP ${res.status.toString()}`);

const live = parseGoogleForm(await res.text());
const problems = formDrift(mailingList.questions, live);
if (problems.length > 0) {
  console.error(`Mailing-list form drift (${url}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log(`Mailing-list form OK: ${live.length.toString()} questions, all ${Object.keys(mailingList.questions).length.toString()} configured IDs present.`);
}
