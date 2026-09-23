/**
 * Static export: builds `dist/` from `public/` for hosts that only serve files
 * (Cloudflare Pages, DO Spaces/App Platform static, any nginx/Caddy).
 *
 * Today this is a copy plus generated `robots.txt` / `sitemap.xml` / `_headers`.
 * Once content moves to data files (see docs/site-audit.md), the render step slots in
 * between `clean` and `writeMeta`, and everything downstream stays the same.
 *
 * Usage: node scripts/export.mts   (SITE_URL=https://example.com to override the canonical origin)
 */
import { cp, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SRC = resolve('public');
const OUT = resolve('dist');
const SITE_URL = (process.env.SITE_URL ?? 'https://hivesocietyimprov.com').replace(/\/$/, '');

async function clean(): Promise<void> {
  await rm(OUT, { recursive: true, force: true });
  await cp(SRC, OUT, { recursive: true });
}

/** Extensionless URLs, matching how Pages (and src/server.mts) serve `foo.html` at `/foo`. */
async function pageUrls(): Promise<string[]> {
  const files = await readdir(OUT);
  return files
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => (f === 'index.html' ? `${SITE_URL}/` : `${SITE_URL}/${f.slice(0, -'.html'.length)}`));
}

async function writeMeta(): Promise<void> {
  const urls = await pageUrls();
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${u}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');

  // Cloudflare Pages header rules; ignored by other hosts. Mirrors the server's Cache-Control policy.
  const headers = ['/assets/*', '  Cache-Control: public, max-age=86400', ''].join('\n');

  await Promise.all([
    writeFile(join(OUT, 'sitemap.xml'), sitemap),
    writeFile(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`),
    writeFile(join(OUT, '_headers'), headers),
  ]);
  console.log(`Exported ${urls.length.toString()} pages to ${OUT}`);
}

await clean();
await writeMeta();
