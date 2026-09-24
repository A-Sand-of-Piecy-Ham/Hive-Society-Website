import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarLinks, loadSite, parseSite } from '../src/site.mts';

const ID = 'abc123@group.calendar.google.com';

describe('site settings', () => {
  it('loads the committed content/site.yaml', async () => {
    const site = await loadSite();
    assert.match(site.calendar.googleCalendarId, /@group\.calendar\.google\.com$/);
  });

  it('rejects a missing or malformed calendar ID, naming the key', () => {
    assert.throws(() => parseSite('calendar: {}'), /calendar\.google-calendar-id/);
    assert.throws(() => parseSite('calendar:\n  google-calendar-id: not an id'), /calendar\.google-calendar-id/);
  });

  it('rejects non-numeric mailing-list question IDs, naming the question', () => {
    const yaml = [
      'calendar:\n  google-calendar-id: a@group.calendar.google.com',
      'mailing-list:\n  google-form-id: 1FAIpQLSfBh_LjjkSFeL1cqT6u\n  questions:\n    email: abc',
    ].join('\n');
    assert.throws(() => parseSite(yaml), /mailing-list\.questions\.email/);
  });
});

describe('calendar links', () => {
  const links = calendarLinks(ID);

  it('builds the Google "add calendar" link from the base64 calendar ID', () => {
    const url = new URL(links['calendar-google'] ?? '');
    assert.equal(url.origin, 'https://calendar.google.com');
    assert.equal(Buffer.from(url.searchParams.get('cid') ?? '', 'base64').toString('utf8'), ID);
  });

  it('points iCal and webcal at the same public feed, with the ID URL-encoded', () => {
    const feed = 'calendar.google.com/calendar/ical/abc123%40group.calendar.google.com/public/basic.ics';
    assert.equal(links['calendar-ics'], `https://${feed}`);
    assert.equal(links['calendar-webcal'], `webcal://${feed}`);
  });
});
