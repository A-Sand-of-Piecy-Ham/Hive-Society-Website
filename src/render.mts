/**
 * The one HTML transform shared by the server (live) and the static export, so both produce the same pages:
 *
 * 1. Named links: `<a data-site-link="calendar-google" href="#">` gets its `href` from site settings
 *    (`src/site.mts`), so values like the calendar ID live in one place instead of in page markup.
 * 2. Asset fingerprints (export only): local `assets/…` references get `?v=<content hash>`. A changed file
 *    gets a new URL, so browsers fetch it immediately; unchanged files can be cached for a year. This is
 *    what makes a "disable caching" switch unnecessary.
 * 3. Canonical URL (export only): `<link rel="canonical">` naming the page's one real address, so search
 *    engines fold workers.dev, preview, and `?utm_…` copies into it.
 *
 * Interim: a template engine (see docs/PROJECT_LOG.md) replaces this when pages become templates.
 */

export interface RenderContext {
  /** Named link targets, e.g. from `siteLinks()`. Unknown names are an error, not a silent `#`. */
  links: Readonly<Record<string, string>>;
  /** Returns a version token for a site-root-relative asset path (e.g. `assets/x.css`), or undefined to leave it. */
  assetVersion?: (assetPath: string) => string | undefined;
  /** Absolute URL to declare as the page's canonical address; omitted for the live server and the 404 page. */
  canonicalUrl?: string;
}

const TAG_WITH_SITE_LINK = /<a\b[^>]*\bdata-site-link="([^"]+)"[^>]*>/g;
/** `assets/…` or root-absolute `/assets/…` (the 404 page uses absolute URLs: it's served at any depth). */
const ASSET_ATTR = /\b(href|src)="(\/?)(assets\/[^"?#]+)(?:\?[^"#]*)?(#[^"]*)?"/g;

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function renderPage(html: string, ctx: RenderContext): string {
  let out = html.replace(TAG_WITH_SITE_LINK, (tag: string, name: string) => {
    // hasOwn, not `in`/lookup: names like "constructor" must not resolve to Object.prototype members.
    if (!Object.hasOwn(ctx.links, name)) throw new Error(`Unknown data-site-link "${name}"`);
    const href = `href="${escapeAttr(ctx.links[name] ?? '')}"`;
    return /\bhref="[^"]*"/.test(tag) ? tag.replace(/\bhref="[^"]*"/, href) : tag.replace(/>$/, ` ${href}>`);
  });

  const { assetVersion } = ctx;
  if (assetVersion) {
    out = out.replace(ASSET_ATTR, (whole: string, attr: string, slash: string, path: string, hash: string | undefined) => {
      const version = assetVersion(path);
      return version ? `${attr}="${slash}${path}?v=${version}${hash ?? ''}"` : whole;
    });
  }
  if (ctx.canonicalUrl !== undefined) {
    // One source of truth: a hand-written tag would drift from the export's URLs, so it's an error.
    if (/<link\b[^>]*\brel="canonical"/.test(out)) throw new Error('Page already has a canonical link; the export adds it');
    if (!out.includes('</head>')) throw new Error('Page has no </head> to add a canonical link to');
    out = out.replace('</head>', `  <link rel="canonical" href="${escapeAttr(ctx.canonicalUrl)}">\n</head>`);
  }
  return out;
}
