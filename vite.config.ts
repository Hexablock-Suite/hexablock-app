import { defineConfig } from 'vite-plus';

// Vite+ holds the lint (Oxlint), format (Oxfmt) and staged-file settings.
// Metro builds the app. Vite does not bundle it.
export default defineConfig({
  lint: {
    ignorePatterns: ['node_modules/**', '.expo/**', 'dist/**', 'coverage/**', 'test/fixtures/**'],
    rules: {},
  },
  fmt: {
    ignorePatterns: ['pnpm-lock.yaml', 'assets/**', 'test/fixtures/**'],
    singleQuote: true,
    printWidth: 100,
  },
});
