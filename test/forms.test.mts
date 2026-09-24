import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formDrift, parseGoogleForm } from '../src/forms.mts';

/** Minimal stand-in for a viewform page: same FB_PUBLIC_LOAD_DATA_ shape as the live mailing-list form. */
const page = (items: unknown[]): string =>
  `<script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify([null, [null, items]])};</script>`;
const NAME = [1, 'Name', null, 0, [[111, null, 1]]];
const EMAIL = [2, 'Email ', null, 0, [[222, null, 1]]];
const INTERESTS = [3, 'Interests', null, 4, [[333, [['Join'], ['Fan']], 1]]];
const SECTION = [4, 'Section header', null, 8, null];

describe('parseGoogleForm', () => {
  it('reads entry IDs, titles, types, required flags, and options; skips non-questions', () => {
    assert.deepEqual(parseGoogleForm(page([NAME, INTERESTS, SECTION])), [
      { entryId: '111', title: 'Name', type: 0, required: true, options: [] },
      { entryId: '333', title: 'Interests', type: 4, required: true, options: ['Join', 'Fan'] },
    ]);
  });

  it('throws when the page is not a form or the layout changed', () => {
    assert.throws(() => parseGoogleForm('<html></html>'), /No FB_PUBLIC_LOAD_DATA_/);
    assert.throws(() => parseGoogleForm('<script>var FB_PUBLIC_LOAD_DATA_ = [1];</script>'), /Unexpected/);
  });
});

describe('formDrift', () => {
  const configured = { name: '111', email: '222', interests: '333' };
  const live = parseGoogleForm(page([NAME, EMAIL, INTERESTS]));

  it('passes when every configured ID exists and every required question is configured', () => {
    assert.deepEqual(formDrift(configured, live), []);
  });

  it('flags a deleted or re-created question', () => {
    const recreated = parseGoogleForm(page([NAME, [2, 'Email', null, 0, [[999, null, 1]]], INTERESTS]));
    const problems = formDrift(configured, recreated);
    assert.equal(problems.length, 2); // old ID gone + new required question unconfigured
    assert.match(problems[0] ?? '', /"email" \(entry\.222\) no longer exists/);
    assert.match(problems[1] ?? '', /New required question "Email"/);
  });

  it('ignores new optional questions', () => {
    const extra = parseGoogleForm(page([NAME, EMAIL, INTERESTS, [5, 'Pronouns', null, 0, [[555, null, 0]]]]));
    assert.deepEqual(formDrift(configured, extra), []);
  });
});
