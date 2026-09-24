import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONTRAST_WAIVERS, checkContrast, pairLabel, themeColors, themePairs, uncoveredThemeKeys, type ContrastPair } from '../src/contrast.mts';
import { loadTheme } from '../src/theme.mts';

const colors = (entries: Record<string, string>): Map<string, string> => new Map(Object.entries(entries));

describe('checkContrast', () => {
  it('computes WCAG 2.1 ratios (black on white is 21:1)', () => {
    const [r] = checkContrast(colors({ 'a.fg': '#000000', 'a.bg': '#ffffff' }), [{ fg: 'a.fg', bg: 'a.bg', kind: 'text' }]);
    assert.ok(r);
    assert.equal(r.ratio.toFixed(1), '21.0');
    assert.equal(r.required, 4.5);
  });

  it('uses the lower 3:1 minimum for large text and icons', () => {
    const pairs: ContrastPair[] = [{ fg: 'a.fg', bg: 'a.bg', kind: 'large' }, { fg: 'a.fg', bg: 'a.bg', kind: 'ui' }];
    assert.deepEqual(checkContrast(colors({ 'a.fg': '#777777', 'a.bg': '#ffffff' }), pairs).map((r) => r.required), [3, 3]);
  });

  it('composites a translucent background over the color beneath it', () => {
    const c = colors({ 'n.text': '#000000', 'n.bg': '#00000000', 'p.bg': '#ffffff' });
    const [clear] = checkContrast(c, [{ fg: 'n.text', bg: 'n.bg', under: 'p.bg', kind: 'text' }]);
    assert.ok(clear);
    assert.equal(clear.ratio.toFixed(1), '21.0'); // fully transparent: the white page shows through
  });

  it('names a pair key missing from the theme', () => {
    assert.throws(() => checkContrast(colors({}), [{ fg: 'gone.text', bg: 'gone.bg', kind: 'text' }]), /"gone\.bg", which isn't in theme\.yaml/);
  });
});

describe('the site theme', async () => {
  const doc = (await loadTheme('content/theme.yaml')) as Record<string, unknown>;
  const all = themeColors(doc);
  const pairs = themePairs(doc);

  it('puts every color key in at least one contrast pair', () => {
    assert.deepEqual(uncoveredThemeKeys(all, pairs), []);
  });

  it('adds a pair per team', () => {
    assert.ok(pairs.some((p) => p.fg === 'teams.usuc.text' && p.bg === 'teams.usuc.background'));
  });

  it('meets the minimum everywhere except waived pairs, and every waiver is still needed', () => {
    const failing = checkContrast(all, pairs).filter((r) => r.ratio < r.required).map((r) => pairLabel(r.pair));
    assert.deepEqual(failing.sort(), Object.keys(CONTRAST_WAIVERS).sort());
  });
});
