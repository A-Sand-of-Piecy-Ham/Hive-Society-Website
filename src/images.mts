/**
 * Image policy for committed images: size limits, per-file exceptions (content/site.yaml → images),
 * and no duplicate files. Git keeps every version of every file forever, so an oversized photo
 * that slips in bloats the repository permanently, not just the page.
 *
 * Dimensions are read from file headers (PNG IHDR, JPEG SOF, GIF logical screen) instead of pulling
 * in an image library; SVG is vector and only size-checked.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { parse } from 'yaml';

export interface ImagePolicy {
  maxLongEdgePx: number;
  maxFileKb: number;
  /** File name (relative to the images directory) → reason it may exceed the limits. */
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
    if (Object.hasOwn(policy.exceptions, f.name)) continue;
    const longEdge = Math.max(f.width ?? 0, f.height ?? 0);
    if (longEdge > policy.maxLongEdgePx) {
      problems.push(`${f.name}: ${String(f.width)}×${String(f.height)} px is over the ${String(policy.maxLongEdgePx)} px limit. Resize it, or add an exception with a reason.`);
    }
    const kb = Math.ceil(f.bytes / 1024);
    if (kb > policy.maxFileKb) {
      problems.push(`${f.name}: ${String(kb)} KB is over the ${String(policy.maxFileKb)} KB limit. Re-save as JPEG (quality ~82), or add an exception with a reason.`);
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

/** Reads the `images` section of content/site.yaml, naming the bad key on error. */
export function parseImagePolicy(text: string): ImagePolicy {
  const images = (parse(text) as { images?: Record<string, unknown> } | null)?.images;
  const maxLongEdgePx = images?.['max-long-edge-px'];
  const maxFileKb = images?.['max-file-kb'];
  const exceptions: unknown = images?.exceptions ?? {};
  if (typeof maxLongEdgePx !== 'number' || maxLongEdgePx <= 0) throw new Error('site.yaml: images.max-long-edge-px must be a positive number');
  if (typeof maxFileKb !== 'number' || maxFileKb <= 0) throw new Error('site.yaml: images.max-file-kb must be a positive number');
  if (typeof exceptions !== 'object' || exceptions === null) throw new Error('site.yaml: images.exceptions must be a map of file name → reason');
  for (const [name, reason] of Object.entries(exceptions)) {
    if (typeof reason !== 'string' || reason.trim() === '') throw new Error(`site.yaml: images.exceptions."${name}" needs a reason`);
  }
  return { maxLongEdgePx, maxFileKb, exceptions: exceptions as Record<string, string> };
}
