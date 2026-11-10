/** @jest-environment node */
import { Resolution } from '../../../src/domain/engine/resolution';

describe('Resolution', () => {
  it('should_throw_when_a_rejected_resolution_is_evaluated', () => {
    const rejected = Resolution.rejected();

    expect(() => rejected.evaluated('victory')).toThrow(
      new RangeError('A rejected resolution cannot be evaluated.'),
    );
    expect(rejected.outcome).toBe('playing');
  });

  it('should_be_equal_when_accepted_and_outcome_match', () => {
    const won = Resolution.resolved().evaluated('victory');

    expect(won.equals(Resolution.resolved().evaluated('victory'))).toBe(true);
    expect(Resolution.rejected().equals(Resolution.rejected())).toBe(true);
    expect(Resolution.resolved().equals(Resolution.resolved())).toBe(true);
  });

  it('should_not_be_equal_when_accepted_or_outcome_differs', () => {
    const won = Resolution.resolved().evaluated('victory');

    expect(won.equals(Resolution.resolved().evaluated('game-over'))).toBe(false);
    expect(won.equals(Resolution.resolved())).toBe(false);
    expect(Resolution.resolved().equals(Resolution.rejected())).toBe(false);
    expect(Resolution.rejected().equals(Resolution.resolved())).toBe(false);
  });
});
