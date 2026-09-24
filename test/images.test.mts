import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkImages, parseImagePolicy, rasterSize, type ImageFile } from '../src/images.mts';

/** Minimal headers: just enough bytes for the dimension parser. */
function png(w: number, h: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}
function jpeg(w: number, h: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]); // segment with a 2-byte payload
  const sof2 = Buffer.from([0xff, 0xc2, 0x00, 0x0b, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0x00, 0x00, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof2]);
}

const policy = { maxLongEdgePx: 1200, maxFileKb: 300, exceptions: { 'hero.jpg': 'full-width hero' } };
const file = (name: string, width: number, height: number, kb = 100, sha256 = name): ImageFile => ({ name, width, height, bytes: kb * 1024, sha256 });

describe('rasterSize', () => {
  it('reads PNG, progressive JPEG (skipping earlier segments), and GIF headers', () => {
    assert.deepEqual(rasterSize(png(1230, 640)), { width: 1230, height: 640 });
    assert.deepEqual(rasterSize(jpeg(1920, 1009)), { width: 1920, height: 1009 });
    const gif = Buffer.from('GIF89a\x40\x01\xf0\x00', 'latin1');
    assert.deepEqual(rasterSize(gif), { width: 320, height: 240 });
  });

  it('rejects formats it cannot measure', () => {
    assert.throws(() => rasterSize(Buffer.from('RIFF....WEBP')), /unsupported image format/);
  });
});

describe('checkImages', () => {
  it('passes images within limits, and exceptions regardless of size', () => {
    assert.deepEqual(checkImages([file('a.jpg', 1200, 800), file('hero.jpg', 1920, 1009, 331)], policy), []);
  });

  it('flags oversized dimensions and file sizes, naming the file', () => {
    const problems = checkImages([file('big.jpg', 4032, 3024, 2900)], { ...policy, exceptions: {} });
    assert.equal(problems.length, 2);
    assert.match(problems[0] ?? '', /^big\.jpg: 4032×3024 px is over the 1200 px limit/);
    assert.match(problems[1] ?? '', /^big\.jpg: 2900 KB is over the 300 KB limit/);
  });

  it('flags identical files and stale exceptions', () => {
    const problems = checkImages([file('a.jpg', 10, 10, 1, 'same'), file('b.jpg', 10, 10, 1, 'same')], policy);
    assert.deepEqual(problems, ['Identical files: a.jpg, b.jpg. Keep one and point every page at it.', 'Exception for "hero.jpg" but no such image. Remove it from content/site.yaml.']);
  });
});

describe('parseImagePolicy', () => {
  it('requires a reason for every exception', () => {
    const yaml = 'images:\n  max-long-edge-px: 1200\n  max-file-kb: 300\n  exceptions:\n    x.jpg: ""';
    assert.throws(() => parseImagePolicy(yaml), /exceptions\."x\.jpg" needs a reason/);
  });
});
