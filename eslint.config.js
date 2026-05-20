// @ts-check
/**
 * Lint « soft » mobile (Lot 1 du PLATFORM_BLUEPRINT).
 *
 * Toutes les règles sont en `warn` et le script `npm run lint:soft` ignore le
 * code de sortie : on cherche à exposer la dérive sans bloquer la livraison.
 * Une bascule en `error` + porte CI suivra après les lots 2–6 (cf. blueprint).
 */
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      '.expo/**',
      'metro.config.js',
      'babel.config.js',
      'scripts/**',
      'src/tests/**/*.spec.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },
];
