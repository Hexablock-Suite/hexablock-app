/** @jest-environment node */
import {
  GameOverPhase,
  PlayingPhase,
  ResolvingPhase,
  VictoryPhase,
} from '../../../src/domain/engine/game-phase';
import { Outcome } from '../../../src/domain/engine/outcome';

// Issue #207 (classes.md decision 45): `Outcome` is a class with a closed set of three instances.
// `closed-sets.test.ts` holds the tests that every closed set shares.
// Before #207 a `switch` with a `never` branch checked the union at compile time.
// A class has no such check, so the last test asks every instance of the set for its phase.
describe('Outcome', () => {
  it('should_give_the_shared_instance_when_a_text_names_an_outcome', () => {
    expect(Outcome.of('playing')).toBe(Outcome.playing);
    expect(Outcome.of('victory')).toBe(Outcome.victory);
    expect(Outcome.of('game-over')).toBe(Outcome.gameOver);
  });

  // A JSON body keeps the text. The inherited names of an object are not outcomes.
  it('should_throw_a_range_error_when_a_text_names_an_unknown_outcome', () => {
    for (const name of ['draw', '', 'Playing', 'gameOver', 'constructor', '__proto__']) {
      expect(() => Outcome.of(name)).toThrow(new RangeError(`Unknown outcome: ${name}.`));
    }
  });

  it('should_end_the_game_when_the_outcome_is_victory_or_game_over', () => {
    expect(Outcome.victory.endsTheGame()).toBe(true);
    expect(Outcome.gameOver.endsTheGame()).toBe(true);
  });

  it('should_keep_the_game_when_the_outcome_is_playing', () => {
    expect(Outcome.playing.endsTheGame()).toBe(false);
  });

  it('should_have_a_phase_when_each_outcome_of_the_set_follows_a_resolved_turn', () => {
    const outcomes = Object.values(Outcome).filter((value) => value instanceof Outcome);

    expect(outcomes.map((outcome) => ResolvingPhase.instance.after(outcome))).toEqual([
      PlayingPhase.instance,
      VictoryPhase.instance,
      GameOverPhase.instance,
    ]);
  });
});
