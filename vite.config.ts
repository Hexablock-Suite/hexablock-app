import { defineConfig } from 'vite-plus';

// Gate tests set LINT_FIXTURES=1 to lint the wrong examples in test/fixtures.
// Every other run skips them.
const fixtureIgnore = process.env.LINT_FIXTURES === '1' ? [] : ['test/fixtures/**'];

// Test titles follow should_<expected_result>_when_<condition>. Describe titles are free.
// Oxlint 1.89 ignores the [pattern, message] form of mustMatch, so the pattern is a string.
const testTitle = '^should_[a-z0-9_]+_when_[a-z0-9_]+$';

// Vite+ holds the lint (Oxlint), format (Oxfmt) and staged-file settings.
// Metro builds the app. Vite does not bundle it.
export default defineConfig({
  lint: {
    ignorePatterns: ['node_modules/**', '.expo/**', 'dist/**', 'coverage/**', ...fixtureIgnore],
    plugins: ['typescript', 'unicorn', 'oxc', 'jest'],
    jsPlugins: ['./scripts/lint/hexablock-plugin.mjs'],
    rules: {
      'jest/valid-title': ['error', { mustMatch: { it: testTitle, test: testTitle } }],
    },
    overrides: [
      {
        // Matches src/domain/ at any depth, so fixtures follow the same rule.
        files: ['**/src/domain/**'],
        rules: { 'hexablock/no-ambient-nondeterminism': 'error' },
      },
    ],
  },
  fmt: {
    ignorePatterns: ['pnpm-lock.yaml', 'assets/**', 'test/fixtures/**'],
    singleQuote: true,
    printWidth: 100,
  },
});
