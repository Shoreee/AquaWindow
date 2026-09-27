import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importPlugin from 'eslint-plugin-import';

const layerRules = {
  'import/no-restricted-paths': [
    'error',
    {
      zones: [
        {
          target: './packages/wm-kernel',
          from: ['./packages/ui-shell', './packages/apps', './packages/study', './apps'],
          message: 'wm-kernel must stay framework-free and must not import UI or study code.',
        },
        {
          target: './packages/fluid-field',
          from: ['./packages/ui-shell', './packages/apps', './packages/study', './apps', './packages/agent-sdk'],
          message: 'fluid-field is a pure geometry/solver layer.',
        },
        {
          target: './packages/agent-sdk',
          from: ['./packages/ui-shell', './packages/apps', './apps'],
          message: 'agent-sdk must not depend on the OS shell or apps.',
        },
      ],
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      ...layerRules,
    },
  },
);
