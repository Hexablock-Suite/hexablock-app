/** @jest-environment node */
import { lintFixture } from '../support/run-tool';

const rule = 'hexablock(no-ambient-nondeterminism)';

describe('domain purity gate (Oxlint)', () => {
  it('should_fail_lint_when_domain_reads_ambient_time_or_randomness', () => {
    const result = lintFixture('test/fixtures/lint/src/domain/engine/ambient-nondeterminism.ts');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(`${rule}: Domain code must not use Math.random`);
    expect(result.output.split(`${rule}: Domain code must not use Date.now`)).toHaveLength(3);
    expect(result.output).toContain(`${rule}: Domain code must not call new Date()`);
  });

  it('should_pass_lint_when_domain_takes_injected_clock_and_random_source', () => {
    const result = lintFixture('test/fixtures/lint/src/domain/engine/injected-sources.ts');

    expect(result.output).toBe('');
    expect(result.status).toBe(0);
  });

  it('should_pass_lint_when_infrastructure_reads_system_clock', () => {
    const result = lintFixture('test/fixtures/lint/src/infrastructure/system-clock.ts');

    expect(result.output).toBe('');
    expect(result.status).toBe(0);
  });
});
