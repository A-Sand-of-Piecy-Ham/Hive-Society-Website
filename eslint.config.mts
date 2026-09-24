import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['public/', 'dist/']), // vendored Mobirise assets and build output
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,   // or .recommended for syntax-only (faster, no tsconfig needed)
  {
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      // node:test's describe/it return promises the runner tracks itself; awaiting them is wrong.
      '@typescript-eslint/no-floating-promises': [
        'error',
        { allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['describe', 'it', 'test', 'suite'] }] },
      ],
    },
  },
);
