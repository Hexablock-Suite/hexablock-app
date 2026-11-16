/** @jest-environment node */
import {
  GameOverPhase,
  PausedPhase,
  PlayingPhase,
  ResolvingPhase,
  VictoryPhase,
} from '../../../src/domain/engine/game-phase';
import { Outcome } from '../../../src/domain/engine/outcome';
import { Resolution } from '../../../src/domain/engine/resolution';

// The fields of a resolution are private (issue #240). A reader asks its queries.
const won = () => Resolution.resolved().evaluated(Outcome.victory);
const lost = () => Resolution.resolved().evaluated(Outcome.gameOver);

describe('Resolution', () => {
  it('should_throw_when_a_rejected_resolution_is_evaluated', () => {
    const rejected = Resolution.rejected();

    expect(() => rejected.evaluated(Outcome.victory)).toThrow(
      new RangeError('A rejected resolution cannot be evaluated.'),
    );
    expect(rejected.equals(Resolution.rejected())).toBe(true);
    expect(rejected.leadsTo()).toBe(Outcome.playing);
  });

  it('should_be_equal_when_accepted_and_outcome_match', () => {
    expect(won().equals(won())).toBe(true);
    expect(Resolution.rejected().equals(Resolution.rejected())).toBe(true);
    expect(Resolution.resolved().equals(Resolution.resolved())).toBe(true);
  });

  it('should_not_be_equal_when_accepted_or_outcome_differs', () => {
    expect(won().equals(lost())).toBe(false);
    expect(won().equals(Resolution.resolved())).toBe(false);
    expect(Resolution.resolved().equals(Resolution.rejected())).toBe(false);
    expect(Resolution.rejected().equals(Resolution.resolved())).toBe(false);
  });

  it('should_tell_whether_the_rules_accepted_the_move_when_a_reader_asks_was_accepted', () => {
    expect(Resolution.rejected().wasAccepted()).toBe(false);
    expect(Resolution.resolved().wasAccepted()).toBe(true);
    expect(won().wasAccepted()).toBe(true);
    expect(lost().wasAccepted()).toBe(true);
  });

  it('should_end_the_game_when_the_turn_leads_to_victory_or_game_over', () => {
    expect(won().endsTheGame()).toBe(true);
    expect(lost().endsTheGame()).toBe(true);
    expect(Resolution.resolved().endsTheGame()).toBe(false);
    expect(Resolution.resolved().evaluated(Outcome.playing).endsTheGame()).toBe(false);
    // A rejected move ends no game.
    expect(Resolution.rejected().endsTheGame()).toBe(false);
  });

  it('should_give_the_phase_of_its_outcome_when_the_engine_asks_the_phase_after_a_turn', () => {
    expect(won().phaseAfter(ResolvingPhase.instance)).toBe(VictoryPhase.instance);
    expect(lost().phaseAfter(ResolvingPhase.instance)).toBe(GameOverPhase.instance);
    expect(Resolution.resolved().phaseAfter(ResolvingPhase.instance)).toBe(PlayingPhase.instance);
    expect(won().phaseAfter(PlayingPhase.instance)).toBe(VictoryPhase.instance);
    // A phase that ignores the outcome keeps its own answer.
    expect(won().phaseAfter(PausedPhase.instance)).toBe(PausedPhase.instance);
    expect(Resolution.rejected().phaseAfter(ResolvingPhase.instance)).toBe(PlayingPhase.instance);
  });

  it('should_give_the_outcome_that_the_rules_gave_when_a_reader_asks_where_the_turn_leads', () => {
    expect(won().leadsTo()).toBe(Outcome.victory);
    expect(lost().leadsTo()).toBe(Outcome.gameOver);
    expect(Resolution.resolved().leadsTo()).toBe(Outcome.playing);
  });
});
