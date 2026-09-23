import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';

const hostname = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8080);
/** Directory served as the site root. Overridable so the same server can serve `dist/`. */
const root = resolve(process.env.STATIC_DIR ?? 'public');

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
 */
async function resolveFile(urlPath: string): Promise<string | undefined> {
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

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');

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

  const file = await resolveFile(pathname);
  if (!file) {
    sendText(res, 404, 'Not Found');
    return;
  }

  const ext = extname(file);
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
    // HTML must revalidate so edits show up; assets aren't content-hashed, so cache for a day, not forever.
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  await pipeline(createReadStream(file), res);
}

const server = createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    console.error(err);
    if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
    else res.destroy();
  });
});

// Kubernetes sends SIGTERM on rollout/scale-down; stop accepting connections and let in-flight ones drain.
process.on('SIGTERM', () => server.close());

server.listen(port, hostname, () => {
  console.log(`Serving ${root} at http://${hostname}:${port.toString()}/`);
});
