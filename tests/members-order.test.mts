/**
 * The members page order is fixed by rule, so nobody's position depends on who edited the page
 * last (so no one gets hurt fee-fees :P).
 * - Executive Board: by position rank (RANK below), then seniority.
 * - Active Members and Alumni: by seniority.
 * Seniority = earliest graduation year first, then last name, then first name; members without a
 * year yet ("Class of '??") come last.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const page = await readFile('public/members.html', 'utf8');

interface Person { name: string; year: number; role?: string }

const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

/** "Class of '27", "Class of Fall '23", "Graduate Class of '25", "Class of '(19)25" → 27, 23, 25, 25; unknown → 99. */
function classYear(html: string): number {
  const m = /Class of (?:Fall )?'(?:\(19\))?(\d\d)/.exec(text(html));
  return m?.[1] === undefined ? 99 : Number(m[1]);
}

/** Executive Board roles, highest first. A role not listed here fails the test, so a new role gets a rank. */
const RANK = ['Hive Co-President', 'Hive Vice President', 'Hive Secretary', 'Hive Treasurer', 'Hive Membership Director'];

function sortKey({ name, year, role }: Person): string {
  const parts = name.replace(/"[^"]*"/g, '').trim().split(/\s+/);
  const rank = role === undefined ? 0 : RANK.indexOf(role);
  assert.ok(rank >= 0, `unknown Executive Board role "${role ?? ''}" for ${name}; add it to RANK`);
  return `${String(rank).padStart(2, '0')} ${String(year).padStart(2, '0')} ${(parts.at(-1) ?? '').toLowerCase()} ${(parts[0] ?? '').toLowerCase()}`;
}

/** Cards between `start` and `end`, each read with `cardPattern` (group 1 = card HTML, containing the name). */
function people(start: string, end: string, cardPattern: RegExp, namePattern: RegExp): Person[] {
  const from = page.indexOf(start);
  const section = page.slice(from, page.indexOf(end, from + start.length));
  return [...section.matchAll(cardPattern)].map(([card]) => {
    const person: Person = { name: text(namePattern.exec(card)?.[1] ?? '').trim(), year: classYear(card) };
    // Board cards open with the role: <p class="body-text …">Hive Co-President<br>…
    const role = /<p class="body-text[^"]*">([^<]*)<br>/.exec(card)?.[1];
    if (role !== undefined && start.includes('executive-board')) person.role = role.trim();
    return person;
  });
}

const sections = {
  'Executive Board': people('id="executive-board"', 'id="active-members"', /<section class="feature-row[\s\S]*?<\/section>/g, /<h3[^>]*>\s*<strong>(.*?)<\/strong>/),
  'Active Members': people('<section class="member-grid"', '<section class="section-heading', /<div class="item [\s\S]*?<\/h3>[\s\S]*?<\/div>\s*<\/div>/g, /<h3[^>]*>\s*<strong>(.*?)<\/strong>/),
  Alumni: people('<section class="alumni-list"', '</section>', /<div class="item [\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, /<h3[^>]*>\s*<strong>(.*?)<\/strong>/),
};

describe('members page order', () => {
  for (const [title, list] of Object.entries(sections)) {
    it(`${title} is in the required order`, () => {
      assert.ok(list.length > 0, `found no people under ${title}; did the markup change?`);
      const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      assert.deepEqual(list.map((p) => p.name), sorted.map((p) => p.name));
    });
  }

  it('reads every card (counts match the page)', () => {
    assert.equal(sections['Executive Board'].length, (page.match(/<section class="feature-row/g) ?? []).length);
    assert.equal(sections['Active Members'].length, (page.match(/<h3 class="item-title/g) ?? []).length);
    assert.equal(sections.Alumni.length, (page.match(/<h3 class="card-title/g) ?? []).length);
  });
});
