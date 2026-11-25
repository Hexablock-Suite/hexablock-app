/** @jest-environment node */
import { lintFixture } from '../support/run-tool';

const rule = 'hexablock(no-ambient-nondeterminism)';

describe('domain purity gate (Oxlint)', () => {
  let domainResult: ReturnType<typeof lintFixture>;

  beforeAll(() => {
    domainResult = lintFixture('test/fixtures/lint/src/domain/engine/ambient-nondeterminism.ts');
  });

  function diagnostic(message: string): string {
    return `${rule}: Domain and application code must not ${message}`;
  }

  it('should_fail_lint_when_domain_reads_ambient_time_or_randomness', () => {
    expect(domainResult.status).toBe(1);
    expect(domainResult.output).toContain(diagnostic('use Math.random'));
    expect(domainResult.output.split(diagnostic('use Date.now'))).toHaveLength(3);
    expect(domainResult.output).toContain(diagnostic('call new Date()'));
  });

  it('should_report_performance_now_when_domain_reads_the_performance_clock', () => {
    expect(domainResult.output).toContain(diagnostic('use performance.now'));
  });

  it('should_report_crypto_random_uuid_when_domain_generates_a_random_uuid', () => {
    expect(domainResult.output).toContain(diagnostic('use crypto.randomUUID'));
  });

  it('should_report_crypto_get_random_values_when_domain_draws_random_bytes', () => {
    expect(domainResult.output).toContain(diagnostic('use crypto.getRandomValues'));
  });

  it('should_report_date_call_when_domain_reads_the_current_date_as_text', () => {
    expect(domainResult.output).toContain(diagnostic('call Date()'));
  });

  it('should_pass_lint_when_domain_takes_injected_clock_and_random_source', () => {
    const result = lintFixture('test/fixtures/lint/src/domain/engine/injected-sources.ts');

    expect(result.output).not.toContain(rule);
    expect(result.status).toBe(0);
  });

  it('should_fail_lint_when_application_reads_ambient_time_or_randomness', () => {
    const result = lintFixture('test/fixtures/lint/src/application/timing-aspect.ts');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(`${rule}: Domain and application code must not use Date.now`);
    expect(result.output).toContain(
      `${rule}: Domain and application code must not use Math.random`,
    );
    expect(result.output).toContain(
      `${rule}: Domain and application code must not call new Date()`,
    );
    expect(result.output).toContain(`${rule}: Domain and application code must not call Date()`);
  });

  it('should_pass_lint_when_infrastructure_reads_system_clock', () => {
    const result = lintFixture('test/fixtures/lint/src/infrastructure/system-clock.ts');

    expect(result.output).not.toContain(rule);
    expect(result.status).toBe(0);
  });
});
