/**
 * Static site HTTP server, separated from the entry point (`server.mts`) so tests can
 * start it on an ephemeral port against any directory.
 */
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { renderPage } from './render.mts';
import { loadSite, siteLinks } from './site.mts';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/**
 * Maps a URL path to a file under `root`, mirroring Cloudflare Pages semantics:
 * `/` and directories resolve to `index.html`, and extensionless paths try `<path>.html`.
 * Returns `undefined` for anything missing or outside `root` (path traversal).
 * `root` must be absolute and normalized; `createSiteServer` guarantees this.
 */
export async function resolveFile(root: string, urlPath: string): Promise<string | undefined> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined; // malformed percent-encoding
  }
  const base = join(root, normalize(decoded));
  if (base !== root && !base.startsWith(root + sep)) return undefined;

  const candidates = extname(base) ? [base] : [base, `${base}.html`, join(base, 'index.html')];
  for (const candidate of candidates) {
    const info = await stat(candidate).catch(() => undefined);
    if (info?.isFile()) return candidate;
  }
  return undefined;
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

/**
 * Cache policy. Fingerprinted URLs (`?v=<content hash>`, added by the export) never change content,
 * so they're cached for a year. Everything else, HTML and un-fingerprinted assets alike, must be
 * revalidated on every use (cheap: a 304 via Last-Modified), so an edit is visible on the next load.
 */
function cacheControl(url: URL): string {
  return url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

async function handle(root: string, sitePath: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;

  // Liveness/readiness probe target; deliberately independent of the filesystem.
  if (pathname === '/healthz') {
    sendText(res, 200, 'ok');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendText(res, 405, 'Method Not Allowed');
    return;
  }

  const file = await resolveFile(root, pathname);
  if (!file) {
    sendText(res, 404, 'Not Found');
    return;
  }

  const ext = extname(file);
  const headers = {
    'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': cacheControl(url),
    'X-Content-Type-Options': 'nosniff',
  };

  if (ext === '.html') {
    // Rendered per request (site settings are read fresh), so there is no file date to validate against.
    const html = renderPage(await readFile(file, 'utf8'), { links: siteLinks(await loadSite(sitePath)) });
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : html);
    return;
  }

  // HTTP dates have 1 s resolution; compare at that granularity.
  const modified = new Date(Math.floor((await stat(file)).mtimeMs / 1000) * 1000);
  const since = Date.parse(req.headers['if-modified-since'] ?? '');
  if (!Number.isNaN(since) && modified.getTime() <= since) {
    res.writeHead(304, { 'Cache-Control': headers['Cache-Control'], 'Last-Modified': modified.toUTCString() });
    res.end();
    return;
  }
  res.writeHead(200, { ...headers, 'Last-Modified': modified.toUTCString() });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  await pipeline(createReadStream(file), res);
}

/**
 * Creates (but does not start) a server for the static site rooted at `rootDir`.
 * `sitePath` is the site settings file used to render named links into HTML.
 */
export function createSiteServer(rootDir: string, sitePath = 'content/site.yaml'): Server {
  const root = resolve(rootDir);
  return createServer((req, res) => {
    handle(root, sitePath, req, res).catch((err: unknown) => {
      console.error(err);
      if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
      else res.destroy();
    });
  });
}
