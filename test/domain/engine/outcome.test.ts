/** @jest-environment node */
import type { Outcome } from '../../../src/domain/engine/outcome';

// A type-level exhaustiveness check of the closed union `Outcome`.
// Each case of the switch names one outcome. The default branch assigns the outcome to `never`.
// When a new value joins `Outcome`, that value reaches the default branch.
// Then `pnpm typecheck` fails with TS2322 on the `never` line, and the new value needs a case.
// Jest does not typecheck, so this test goes red only in `pnpm typecheck`.
function describeOutcome(outcome: Outcome): string {
  switch (outcome) {
    case 'playing':
      return 'the game goes on';
    case 'victory':
      return 'the player wins';
    case 'game-over':
      return 'the game ends';
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}

describe('Outcome', () => {
  it('should_handle_every_value_when_a_switch_covers_the_closed_union', () => {
    const outcomes: Outcome[] = ['playing', 'victory', 'game-over'];

    expect(outcomes.map(describeOutcome)).toEqual([
      'the game goes on',
      'the player wins',
      'the game ends',
    ]);
  });
});
