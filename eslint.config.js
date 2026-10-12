import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'dist-phaser/', 'node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['scripts/**', 'tests/**', 'eslint.config.js', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
