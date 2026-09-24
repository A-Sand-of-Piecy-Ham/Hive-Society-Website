/**
 * Image policy for committed images: per-class size limits with per-file exceptions (content/site.yaml
 * → image-limits), folder naming rules (member portraits, team photos), and no duplicate files. Git
 * keeps every version of every file forever, so an oversized photo that slips in bloats the
 * repository permanently, not just the page.
 *
 * Dimensions are read from file headers (PNG IHDR, JPEG SOF, GIF logical screen) instead of pulling
 * in an image library; SVG is vector and only size-checked.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { parse } from 'yaml';

/** Size limits for one class of image. */
export interface ImageLimits {
  maxLongEdgePx: number;
  maxFileKb: number;
}

export interface ImageClass {
  /** Section name under `image-limits` in content/site.yaml. */
  key: string;
  /** Folder (relative to the images directory) this class owns; undefined = everything not in another class's folder. */
  folder?: string;
  /** Required file name inside the folder (no subfolders). */
  name?: RegExp;
  /** How to fix a bad name, shown in the error. */
  nameRule?: string;
}

/** Everything not in another class's folder, so no image escapes limits. */
const OTHER: ImageClass = { key: 'other' };

/**
 * Every image belongs to exactly one class, chosen by its top-level folder. Folders and naming rules
 * live here rather than in site.yaml because pages (and, later, CMS media folders) depend on them;
 * only the limits are settings.
 */
export const IMAGE_CLASSES: readonly ImageClass[] = [
  {
    key: 'portraits',
    folder: 'members',
    // firstname-lastname: lowercase ASCII words, at least two, optional -N for a second person with
    // the same name. Doubles as the member's ID once members are data, so it must be predictable.
    name: /^[a-z]+(?:-[a-z]+)+(?:-\d+)?\.jpg$/,
    nameRule: 'member portraits must be named firstname-lastname.jpg (lowercase, hyphens, no subfolders), e.g. members/tess-obrien.jpg.',
  },
  {
    key: 'team-photos',
    folder: 'teams',
    // team-id: matches the team's id in content/theme.yaml where it has one. PNG allowed for logos.
    name: /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|png)$/,
    nameRule: 'team photos must be named after the team, e.g. teams/twist-and-trout.jpg (lowercase, hyphens, .jpg or .png for logos, no subfolders).',
  },
  OTHER,
];

export interface ImagePolicy {
  /** Class key → limits; every class in IMAGE_CLASSES has an entry. */
  limits: Partial<Record<string, ImageLimits>>;
  /** File name (relative to the images directory) → reason it may exceed its class's limits. */
  exceptions: Record<string, string>;
}

export interface ImageFile {
  /** Path relative to the images directory, with forward slashes. */
  name: string;
  bytes: number;
  /** Undefined for vector images (SVG). */
  width?: number;
  height?: number;
  sha256: string;
}

/** The class owning a file, by its top-level folder. */
export function imageClass(name: string): ImageClass {
  const top = name.split('/')[0];
  return IMAGE_CLASSES.find((c) => c.folder !== undefined && c.folder === top) ?? OTHER;
}

/** JPEG start-of-frame markers (baseline, progressive, lossless, arithmetic variants) carry the dimensions. */
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** Returns pixel dimensions for PNG, JPEG, or GIF data; throws for anything else it can't read. */
export function rasterSize(data: Buffer): { width: number; height: number } {
  if (data.length >= 24 && data.readUInt32BE(0) === 0x89504e47) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length >= 10 && data.toString('ascii', 0, 3) === 'GIF') {
    return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  }
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) throw new Error('corrupt JPEG: expected a marker');
      const marker = data[i + 1] ?? 0;
      if (marker === 0xff) {
        i += 1; // fill byte
        continue;
      }
      if (JPEG_SOF.has(marker)) return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
      i += 2 + data.readUInt16BE(i + 2);
    }
    throw new Error('corrupt JPEG: no frame header');
  }
  throw new Error('unsupported image format (use JPEG, PNG, GIF, or SVG)');
}

export async function scanImages(dir: string): Promise<ImageFile[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files: ImageFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const data = await readFile(path);
    const name = relative(dir, path).split('\\').join('/');
    const sha256 = createHash('sha256').update(data).digest('hex');
    const size = extname(name).toLowerCase() === '.svg' ? {} : rasterSize(data);
    files.push({ name, bytes: data.length, sha256, ...size });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/** Every policy violation, phrased as what to do about it. Empty = pass. */
export function checkImages(files: readonly ImageFile[], policy: ImagePolicy): string[] {
  const problems: string[] = [];
  const names = new Set(files.map((f) => f.name));

  for (const f of files) {
    const cls = imageClass(f.name);
    if (cls.name !== undefined && cls.folder !== undefined) {
      const inFolder = f.name.slice(cls.folder.length + 1);
      if (inFolder.includes('/') || !cls.name.test(inFolder)) problems.push(`${f.name}: ${cls.nameRule ?? 'bad file name.'}`);
    }

    if (Object.hasOwn(policy.exceptions, f.name)) continue;
    const limits = policy.limits[cls.key];
    if (limits === undefined) throw new Error(`no limits for image class "${cls.key}"`);
    const label = `${cls.key} limit`;
    const longEdge = Math.max(f.width ?? 0, f.height ?? 0);
    if (longEdge > limits.maxLongEdgePx) {
      problems.push(`${f.name}: ${String(f.width)}×${String(f.height)} px is over the ${String(limits.maxLongEdgePx)} px ${label}. Resize it, or add an exception with a reason.`);
    }
    const kb = Math.ceil(f.bytes / 1024);
    if (kb > limits.maxFileKb) {
      problems.push(`${f.name}: ${String(kb)} KB is over the ${String(limits.maxFileKb)} KB ${label}. Re-save as JPEG (quality ~82), or add an exception with a reason.`);
    }
  }

  const byHash = new Map<string, string[]>();
  for (const f of files) byHash.set(f.sha256, [...(byHash.get(f.sha256) ?? []), f.name]);
  for (const group of byHash.values()) {
    if (group.length > 1) problems.push(`Identical files: ${group.join(', ')}. Keep one and point every page at it.`);
  }

  for (const name of Object.keys(policy.exceptions)) {
    if (!names.has(name)) problems.push(`Exception for "${name}" but no such image. Remove it from content/site.yaml.`);
  }
  return problems;
}

/** Reads the `image-limits` section of content/site.yaml, naming the bad key on error. */
export function parseImagePolicy(text: string): ImagePolicy {
  const section = (parse(text) as Record<string, Record<string, unknown> | undefined> | null)?.['image-limits'] ?? {};
  const known = [...IMAGE_CLASSES.map((c) => c.key), 'exceptions'];
  for (const key of Object.keys(section)) {
    if (!known.includes(key)) throw new Error(`site.yaml: image-limits.${key} is not a known section (expected ${known.join(', ')})`);
  }

  const limits: Partial<Record<string, ImageLimits>> = {};
  for (const { key } of IMAGE_CLASSES) {
    const raw = section[key] as Record<string, unknown> | undefined;
    const maxLongEdgePx = raw?.['max-long-edge-px'];
    const maxFileKb = raw?.['max-file-kb'];
    if (typeof maxLongEdgePx !== 'number' || maxLongEdgePx <= 0) throw new Error(`site.yaml: image-limits.${key}.max-long-edge-px must be a positive number`);
    if (typeof maxFileKb !== 'number' || maxFileKb <= 0) throw new Error(`site.yaml: image-limits.${key}.max-file-kb must be a positive number`);
    limits[key] = { maxLongEdgePx, maxFileKb };
  }

  const exceptions: unknown = section.exceptions ?? {};
  if (typeof exceptions !== 'object' || exceptions === null) throw new Error('site.yaml: image-limits.exceptions must be a map of file path → reason');
  for (const [name, reason] of Object.entries(exceptions)) {
    if (typeof reason !== 'string' || reason.trim() === '') throw new Error(`site.yaml: image-limits.exceptions."${name}" needs a reason`);
  }
  return { limits, exceptions: exceptions as Record<string, string> };
}
