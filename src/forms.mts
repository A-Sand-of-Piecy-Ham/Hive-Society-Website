/**
 * Reading a Google Form's structure, so the site's own sign-up form can post to it and CI can
 * detect drift (a question deleted, re-created, or newly required) before sign-ups silently fail.
 *
 * Google Forms has no public schema API; every `viewform` page embeds its structure as
 * `FB_PUBLIC_LOAD_DATA_`, a nested array. Only the parts relied on here are decoded:
 *   data[1][1]           → items
 *   item[1]              → question title
 *   item[3]              → question type (0 short answer, 1 paragraph, 2 multiple choice, 3 dropdown, 4 checkboxes)
 *   item[4][0][0]        → entry ID (the `entry.<id>` field name a submission uses)
 *   item[4][0][1][i][0]  → option labels (choice questions)
 *   item[4][0][2]        → required flag
 * If Google changes this layout, `parseGoogleForm` throws rather than returning partial data.
 */

export interface FormQuestion {
  entryId: string;
  title: string;
  type: number;
  required: boolean;
  options: string[];
}

export function parseGoogleForm(html: string): FormQuestion[] {
  const match = /FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);\s*<\/script>/s.exec(html);
  if (!match?.[1]) throw new Error('No FB_PUBLIC_LOAD_DATA_ in page: not a Google Form, or its layout changed');
  const data: unknown = JSON.parse(match[1]);
  const items = (data as unknown[][] | null)?.[1]?.[1];
  if (!Array.isArray(items)) throw new Error('Unexpected FB_PUBLIC_LOAD_DATA_ layout (no item list)');

  const questions: FormQuestion[] = [];
  for (const item of items as unknown[][]) {
    const entry = (item[4] as unknown[][] | null | undefined)?.[0];
    if (!Array.isArray(entry)) continue; // section headers, images, etc. have no answer field
    const [entryId, options, required] = entry as [unknown, unknown, unknown];
    if (typeof entryId !== 'number') throw new Error(`Unexpected entry ID ${JSON.stringify(entryId)}`);
    questions.push({
      entryId: String(entryId),
      title: String(item[1]).trim(),
      type: Number(item[3]),
      required: required === 1 || required === true,
      options: Array.isArray(options) ? (options as unknown[][]).map((o) => String(o[0])) : [],
    });
  }
  return questions;
}

/**
 * Compares the site's configured question IDs with the live form. Problems are phrased for the
 * person who has to fix them (usually: update content/site.yaml with the new ID).
 */
export function formDrift(configured: Readonly<Record<string, string>>, live: readonly FormQuestion[]): string[] {
  const liveById = new Map(live.map((q) => [q.entryId, q]));
  const configuredIds = new Set(Object.values(configured));
  const problems: string[] = [];
  for (const [name, id] of Object.entries(configured)) {
    if (!liveById.has(id)) {
      problems.push(`"${name}" (entry.${id}) no longer exists on the form: it was deleted or re-created. Update its ID in content/site.yaml.`);
    }
  }
  for (const q of live) {
    if (q.required && !configuredIds.has(q.entryId)) {
      problems.push(`New required question "${q.title}" (entry.${q.entryId}) isn't on the site's form, so every sign-up would be rejected.`);
    }
  }
  return problems;
}

export function googleFormUrl(formId: string): string {
  return `https://docs.google.com/forms/d/e/${formId}/viewform`;
}
