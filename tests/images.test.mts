import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkImages, imageClass, parseImagePolicy, rasterSize, type ImageFile, type ImagePolicy } from '../src/images.mts';

/** Minimal headers: just enough bytes for the dimension parser. */
function png(w: number, h: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0); // PNG signature, first half
  b.writeUInt32BE(0x0d0a1a0a, 4); // second half
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}
function jpeg(w: number, h: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]); // segment with a 2-byte payload
  const sof2 = Buffer.from([0xff, 0xc2, 0x00, 0x0b, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0x00, 0x00, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof2]);
}

const policy: ImagePolicy = {
  limits: {
    portraits: { maxLongEdgePx: 800, maxFileKb: 150 },
    'team-photos': { maxLongEdgePx: 1200, maxFileKb: 250 },
    other: { maxLongEdgePx: 1200, maxFileKb: 300 },
  },
  exceptions: { 'hero.jpg': 'full-width hero' },
};
const noExceptions: ImagePolicy = { ...policy, exceptions: {} };
const file = (name: string, width: number, height: number, kb = 100, sha256 = name): ImageFile => ({ name, width, height, bytes: kb * 1024, sha256 });

describe('rasterSize', () => {
  it('reads PNG, progressive JPEG (skipping earlier segments), and GIF headers', () => {
    assert.deepEqual(rasterSize(png(1230, 640)), { width: 1230, height: 640 });
    assert.deepEqual(rasterSize(jpeg(1920, 1009)), { width: 1920, height: 1009 });
    const gif = Buffer.from('GIF89a\x40\x01\xf0\x00', 'latin1');
    assert.deepEqual(rasterSize(gif), { width: 320, height: 240 });
  });

  it('rejects formats it cannot measure', () => {
    assert.throws(() => rasterSize(Buffer.from('not an image')), /unreadable or unsupported image/);
  });
});

describe('checkImages', () => {
  it('passes images within limits, and exceptions regardless of size', () => {
    assert.deepEqual(checkImages([file('a.jpg', 1200, 800), file('hero.jpg', 1920, 1009, 331)], policy), []);
  });

  it('flags oversized dimensions and file sizes, naming the file', () => {
    const problems = checkImages([file('big.jpg', 4032, 3024, 2900)], noExceptions);
    assert.equal(problems.length, 2);
    assert.match(problems[0] ?? '', /^big\.jpg: 4032×3024 px is over the 1200 px other limit/);
    assert.match(problems[1] ?? '', /^big\.jpg: 2900 KB is over the 300 KB other limit/);
  });

  it("applies each folder's own limits", () => {
    const problems = checkImages([file('members/tess-obrien.jpg', 1000, 1000, 200), file('teams/umic.png', 1000, 1000, 200)], noExceptions);
    assert.deepEqual(
      problems.map((p) => p.split(':')[0]),
      ['members/tess-obrien.jpg', 'members/tess-obrien.jpg'],
    );
    assert.match(problems[0] ?? '', /800 px portraits limit/);
  });

  it('flags identical files and stale exceptions', () => {
    const problems = checkImages([file('a.jpg', 10, 10, 1, 'same'), file('b.jpg', 10, 10, 1, 'same')], policy);
    assert.deepEqual(problems, ['Identical files: a.jpg, b.jpg. Keep one and point every page at it.', 'Exception for "hero.jpg" but no such image. Remove it from content/site.yaml.']);
  });
});

describe('member portrait naming', () => {
  const names = (list: string[]): string[] => checkImages(list.map((n) => file(n, 800, 800)), noExceptions);

  it('accepts firstname-lastname.jpg, multi-part names, and a numeric suffix', () => {
    assert.deepEqual(names(['members/tess-obrien.jpg', 'members/aiden-garland-sutter.jpg', 'members/alex-kim-2.jpg']), []);
  });

  it('rejects camera names, capitals, single names, other extensions, and subfolders', () => {
    const bad = ['members/IMG_1234.jpg', 'members/Tess-OBrien.jpg', 'members/colin.jpg', 'members/tess-obrien.jpeg', 'members/2025/tess-obrien.jpg'];
    assert.equal(names(bad).length, bad.length);
    assert.match(names(['members/IMG_1234.jpg'])[0] ?? '', /must be named firstname-lastname\.jpg/);
  });

  it('leaves images outside the portraits folder alone', () => {
    assert.deepEqual(names(['dsc0085.jpg', 'teams/twist-and-trout.jpg']), []);
  });
});

describe('team photo naming', () => {
  const names = (list: string[]): string[] => checkImages(list.map((n) => file(n, 800, 800)), noExceptions);

  it('accepts team ids, with .png for logos', () => {
    assert.deepEqual(names(['teams/twist-and-trout.jpg', 'teams/umic.png', 'teams/hive-22-23.jpg']), []);
  });

  it('rejects camera names, capitals, spaces, .jpeg, and subfolders', () => {
    const bad = ['teams/IMG_1234.jpg', 'teams/Twist-and-Trout.jpg', 'teams/twist and trout.jpg', 'teams/umic.jpeg', 'teams/2025/umic.png'];
    assert.equal(names(bad).length, bad.length);
    assert.match(names(['teams/IMG_1234.jpg'])[0] ?? '', /must be named after the team/);
  });
});

describe('imageClass', () => {
  it('classifies by top-level folder, with everything else as other', () => {
    assert.equal(imageClass('members/tess-obrien.jpg').key, 'portraits');
    assert.equal(imageClass('teams/umic.png').key, 'team-photos');
    assert.equal(imageClass('hero.jpg').key, 'other');
    assert.equal(imageClass('logos/umic.png').key, 'other');
    assert.equal(imageClass('teams.jpg').key, 'other');
  });
});

describe('parseImagePolicy', () => {
  const limits = (px: number, kb: number): string => `    max-long-edge-px: ${String(px)}\n    max-file-kb: ${String(kb)}\n`;
  const all = `image-limits:\n  portraits:\n${limits(800, 150)}  team-photos:\n${limits(1200, 250)}  other:\n${limits(1200, 300)}`;

  it('reads limits for every class', () => {
    assert.deepEqual(parseImagePolicy(all), { limits: policy.limits, exceptions: {} });
  });

  it('requires every class, so no image goes unlimited', () => {
    const missing = all.replace(/ {2}other:\n.*/s, '');
    assert.throws(() => parseImagePolicy(missing), /image-limits\.other\.max-long-edge-px must be a positive number/);
  });

  it('rejects unknown sections, catching typos', () => {
    assert.throws(() => parseImagePolicy(`${all}  portrait:\n${limits(1, 1)}`), /image-limits\.portrait is not a known section/);
  });

  it('requires a reason for every exception', () => {
    assert.throws(() => parseImagePolicy(`${all}  exceptions:\n    x.jpg: ""`), /image-limits\.exceptions\."x\.jpg" needs a reason/);
  });
});
