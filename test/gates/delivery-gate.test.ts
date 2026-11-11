/** @jest-environment node */
import { lintFixture } from '../support/run-tool';

// Rule R-no-delivery-call (issue #228, the rule of hexablock-api#90): a value object delivers
// its value to a receiver of the edge. Domain and application code never ask for the delivery.

const rule = 'hexablock(no-delivery-call)';
const message = `${rule}: Domain and application code must not call deliverTo`;

describe('delivery gate (Oxlint)', () => {
  it('should_fail_lint_when_domain_code_calls_a_delivery_operation', () => {
    const result = lintFixture('test/fixtures/lint/src/domain/engine/delivery-call.ts');

    // A plain call, an optional call, a call by a text key and a reference that is bound.
    expect(result.status).not.toBe(0);
    expect(result.output.split(message)).toHaveLength(5);
  });

  it('should_pass_lint_when_a_domain_value_object_declares_its_delivery_operation', () => {
    const result = lintFixture('test/fixtures/lint/src/domain/engine/delivery-operation.ts');

    expect(result.output).not.toContain(rule);
    expect(result.status).toBe(0);
  });

  it('should_fail_lint_when_application_code_calls_a_delivery_operation', () => {
    const result = lintFixture('test/fixtures/lint/src/application/delivery-call.ts');

    expect(result.status).not.toBe(0);
    expect(result.output.split(message)).toHaveLength(2);
  });

  it('should_fail_lint_when_application_code_destructures_a_delivery_operation', () => {
    const result = lintFixture('test/fixtures/lint/src/application/delivery-destructuring.ts');

    // A shorthand key, a key with an alias and a key in a parameter.
    expect(result.status).not.toBe(0);
    expect(result.output.split(message)).toHaveLength(4);
  });

  it('should_pass_lint_when_an_adapter_calls_a_delivery_operation', () => {
    const result = lintFixture('test/fixtures/lint/src/adapters/score-presenter.ts');

    // The fixture holds a plain call and a destructuring of the operation.
    expect(result.output).not.toContain(rule);
    expect(result.status).toBe(0);
  });

  it('should_pass_lint_when_the_real_domain_and_application_code_are_linted', () => {
    const result = lintFixture('src');

    expect(result.output).not.toContain(rule);
    expect(result.status).toBe(0);
  });
});
