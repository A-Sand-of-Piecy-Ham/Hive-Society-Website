/**
 * Site settings (`content/site.yaml`) and the links derived from them.
 * Pages reference links by name (`data-site-link="calendar-google"`), never by value, so changing
 * a setting updates every page on the next render; see `src/render.mts`.
 */
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

export interface SiteConfig {
  calendar: { googleCalendarId: string };
  mailingList: { googleFormId: string; questions: Record<string, string> };
}

/** Google Calendar IDs look like `<id>@group.calendar.google.com` or a plain account address. */
const CALENDAR_ID = /^[^\s@/]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/** Google Form IDs from `/forms/d/e/<id>/viewform` URLs. */
const FORM_ID = /^[\w-]{20,}$/;

function fail(key: string, expected: string, got: unknown): never {
  throw new Error(`site.yaml: ${key} must be ${expected}, got ${JSON.stringify(got)}`);
}

/** Parses and validates site settings, throwing a message that names the bad key. */
export function parseSite(text: string): SiteConfig {
  const doc = (parse(text) ?? {}) as Record<string, Record<string, unknown> | undefined>;

  const calendarId = doc.calendar?.['google-calendar-id'];
  if (typeof calendarId !== 'string' || !CALENDAR_ID.test(calendarId)) {
    fail('calendar.google-calendar-id', 'a Google Calendar ID', calendarId);
  }

  const formId = doc['mailing-list']?.['google-form-id'];
  if (typeof formId !== 'string' || !FORM_ID.test(formId)) fail('mailing-list.google-form-id', 'a Google Form ID', formId);
  const rawQuestions = doc['mailing-list']?.questions;
  if (typeof rawQuestions !== 'object' || rawQuestions === null) {
    fail('mailing-list.questions', 'a map of question name → entry ID', rawQuestions);
  }
  const questions: Record<string, string> = {};
  for (const [name, id] of Object.entries(rawQuestions)) {
    if (!/^\d+$/.test(String(id))) fail(`mailing-list.questions.${name}`, 'a numeric entry ID', id);
    questions[name] = String(id);
  }

  return { calendar: { googleCalendarId: calendarId }, mailingList: { googleFormId: formId, questions } };
}

export async function loadSite(path = 'content/site.yaml'): Promise<SiteConfig> {
  return parseSite(await readFile(path, 'utf8'));
}

/**
 * Public links for the shows calendar:
 * - `calendar-google`: opens Google Calendar with an "Add calendar" prompt (the `cid` form Google's own
 *   "shareable link" uses: base64 of the calendar ID).
 * - `calendar-ics` / `calendar-webcal`: the public iCal feed; `webcal:` makes Apple Calendar and Outlook
 *   subscribe (stay in sync) instead of importing a one-off copy.
 */
export function calendarLinks(calendarId: string): Record<string, string> {
  const feedPath = `calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
  const cid = Buffer.from(calendarId, 'utf8').toString('base64').replace(/=+$/, '');
  return {
    'calendar-google': `https://calendar.google.com/calendar/u/0?cid=${cid}`,
    'calendar-ics': `https://${feedPath}`,
    'calendar-webcal': `webcal://${feedPath}`,
  };
}

/** Every named link pages may reference via `data-site-link`. */
export function siteLinks(site: SiteConfig): Record<string, string> {
  return { ...calendarLinks(site.calendar.googleCalendarId) };
}
