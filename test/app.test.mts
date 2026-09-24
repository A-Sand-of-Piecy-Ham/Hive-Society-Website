import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createSiteServer } from '../src/app.mts';

const server = createSiteServer('public');
let base = '';

before(async () => {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port.toString()}`;
});
after(() => {
  server.close();
});

async function get(path: string, init?: RequestInit): Promise<Response> {
  return fetch(base + path, { redirect: 'manual', ...init });
}

describe('site server', () => {
  it('serves index.html at /', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^text\/html/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  });

  it('serves pages without the .html extension, like Cloudflare Pages', async () => {
    const [bare, withExt] = await Promise.all([get('/members'), get('/members.html')]);
    assert.equal(bare.status, 200);
    assert.equal(await bare.text(), await withExt.text());
  });

  it('makes un-fingerprinted assets revalidate, answering 304 when unchanged', async () => {
    const res = await get('/assets/images/zinger-purple.svg');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/svg+xml');
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    const lastModified = res.headers.get('last-modified') ?? '';
    assert.ok(lastModified);
    const again = await get('/assets/images/zinger-purple.svg', { headers: { 'If-Modified-Since': lastModified } });
    assert.equal(again.status, 304);
  });

  it('caches fingerprinted (?v=) assets for a year', async () => {
    const res = await get('/assets/images/zinger-purple.svg?v=abc');
    assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  });

  it('renders named links into pages from site settings', async () => {
    const html = await (await get('/calendar')).text();
    assert.match(html, /data-site-link="calendar-google" href="https:\/\/calendar\.google\.com\/calendar\/u\/0\?cid=/);
    assert.doesNotMatch(html, /data-site-link="[^"]+" href="#"/);
  });

  it('answers the health probe', async () => {
    const res = await get('/healthz');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'ok');
  });

  it('returns 404 for missing files', async () => {
    assert.equal((await get('/nope')).status, 404);
  });

  it('refuses path traversal, including encoded separators', async () => {
    for (const path of ['/../package.json', '/..%2fpackage.json', '/%2e%2e/%2e%2e/etc/passwd']) {
      assert.equal((await get(path)).status, 404, path);
    }
  });

  it('returns 404 for malformed percent-encoding instead of crashing', async () => {
    assert.equal((await get('/%E0%A4%A')).status, 404);
  });

  it('rejects methods other than GET and HEAD', async () => {
    const res = await get('/', { method: 'POST' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET, HEAD');
  });

  it('answers HEAD with headers and no body', async () => {
    const res = await get('/', { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '');
  });
});
