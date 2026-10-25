/** @jest-environment node */
import { lintFixture } from '../support/run-tool';

describe('test title gate (jest/valid-title)', () => {
  it('should_fail_lint_when_test_title_misses_should_when_pattern', () => {
    const result = lintFixture('test/fixtures/lint/bad-title.test.ts');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('jest(valid-title): it should match');
    expect(result.output).toContain('jest(valid-title): test should match');
  });

  it('should_pass_lint_when_test_titles_follow_should_when_pattern', () => {
    const result = lintFixture('test/fixtures/lint/good-title.test.ts');

    expect(result.output).toBe('');
    expect(result.status).toBe(0);
  });
});
