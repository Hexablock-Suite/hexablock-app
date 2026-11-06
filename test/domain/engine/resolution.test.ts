/** @jest-environment node */
import { Resolution } from '../../../src/domain/engine/resolution';

describe('Resolution', () => {
  it('should_throw_when_a_rejected_resolution_is_evaluated', () => {
    const rejected = Resolution.rejected(3);

    expect(() => rejected.evaluated('victory')).toThrow(
      new RangeError('A rejected resolution cannot be evaluated.'),
    );
    expect(rejected.outcome).toBe('playing');
  });
});
