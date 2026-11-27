/** @jest-environment node */
import { runTool } from '../support/run-tool';

// Runs dependency-cruiser with the repository config on one fixture tree.
function cruise(fixture: string) {
  return runTool('depcruise', [
    '--config',
    '.dependency-cruiser.cjs',
    '--output-type',
    'err',
    `test/fixtures/arch/${fixture}`,
  ]);
}

describe('architecture gate (dependency-cruiser)', () => {
  it('should_fail_arch_when_domain_imports_outside_domain', () => {
    const result = cruise('domain-imports-outside');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('domain-imports-only-domain');
  });

  it('should_fail_arch_when_domain_imports_react', () => {
    const result = cruise('domain-imports-framework');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('domain-no-framework');
  });

  it('should_fail_arch_when_engine_imports_a_variant', () => {
    const result = cruise('engine-imports-variant');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('engine-no-variants');
  });

  it('should_fail_arch_when_variant_imports_another_variant', () => {
    const result = cruise('variant-imports-variant');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('variants-isolated');
  });

  // Issue #423: Hexa Sort binds `TPiece` to `ColorStack`, as Hexa Merge binds it to `NewTile`.
  // So neither variant imports the cell-made `Piece` or the shape Composite of the engine.
  it('should_fail_arch_when_sort_imports_the_cell_made_piece_of_the_engine', () => {
    const result = cruise('sort-imports-piece');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('sort-and-merge-no-cell-piece');
  });

  it('should_fail_arch_when_application_imports_an_adapter', () => {
    const result = cruise('application-imports-outside');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('application-imports-only-domain');
  });

  it('should_fail_arch_when_application_imports_a_variant', () => {
    const result = cruise('application-imports-variant');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('application-no-variants');
  });

  it('should_fail_arch_when_adapter_imports_infrastructure', () => {
    const result = cruise('adapters-imports-outside');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('adapters-imports-only-inner-layers');
  });

  it('should_fail_arch_when_adapter_imports_a_package', () => {
    const result = cruise('adapters-imports-package');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('adapters-imports-only-inner-layers');
  });

  it('should_pass_arch_when_layers_point_inward', () => {
    const result = cruise('clean');

    expect(result.status).toBe(0);
  });
});
