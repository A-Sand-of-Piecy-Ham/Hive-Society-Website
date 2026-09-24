import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadTheme, themeToCssVariables, validateTheme } from '../src/theme.mts';

const paths = (doc: unknown): string[] => validateTheme(doc).map((i) => i.path);

describe('theme validation', () => {
  it('accepts the committed content/theme.yaml', async () => {
    assert.deepEqual(validateTheme(await loadTheme('content/theme.yaml')), []);
  });

  it('accepts 6- and 8-digit hex', () => {
    assert.deepEqual(validateTheme({ navigation: { background: '#ffffffcc', text: '#593269' } }), []);
  });

  it('rejects CSS color names, short hex, and references to other keys', () => {
    const doc = { buttons: { background: 'purple', text: '#fff', 'hover-text': 'buttons.text' } };
    assert.deepEqual(paths(doc), ['buttons.background', 'buttons.text', 'buttons.hover-text']);
  });

  it('rejects nested groups (keys map straight to colors)', () => {
    assert.deepEqual(paths({ footer: { social: { icon: '#593269' } } }), ['footer.social']);
  });

  it('rejects non-kebab-case keys, which would not map cleanly to CSS variables', () => {
    assert.deepEqual(paths({ navigation: { menuIcon: '#593269' } }), ['navigation.menuIcon']);
  });

  it('requires teams to be a list with unique kebab-case ids and both colors', () => {
    const doc = {
      teams: [
        { id: 'usuc', background: '#ffdd00', text: '#593269' },
        { id: 'usuc', background: '#ffdd00', text: '#593269' },
        { id: 'Bad Id', background: '#ffdd00' },
        { id: 'umic', background: '#ffdd00', text: '#593269', accent: '#000000' },
      ],
    };
    assert.deepEqual(paths(doc), ['teams[1].id', 'teams[2].id', 'teams[2].text', 'teams[3].accent']);
    assert.deepEqual(paths({ teams: { usuc: { background: '#ffdd00' } } }), ['teams']);
  });

  it('flattens to CSS custom properties, using team ids', () => {
    const vars = themeToCssVariables({
      navigation: { background: '#ffffff' },
      teams: [{ id: 'usuc', background: '#ffdd00', text: '#593269' }],
    });
    assert.deepEqual(Object.fromEntries(vars), {
      '--navigation-background': '#ffffff',
      '--teams-usuc-background': '#ffdd00',
      '--teams-usuc-text': '#593269',
    });
  });
});
