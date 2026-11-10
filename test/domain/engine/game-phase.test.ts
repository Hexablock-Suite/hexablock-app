/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/outcome';
import { GameId } from '../../../src/domain/engine/game-id';
import { MatchId } from '../../../src/domain/engine/match-id';
import { Score } from '../../../src/domain/engine/score';
import { GameOver } from '../../../src/domain/engine/game-events';
import {
  GameOverPhase,
  PausedPhase,
  PlayingPhase,
  ResolvingPhase,
  VictoryPhase,
  type GamePhase,
} from '../../../src/domain/engine/game-phase';
import { MATCH_ID } from '../../support/engine/match-id';

// The value that `act` throws, or `undefined` when it throws nothing.
function thrownBy(act: () => void): unknown {
  try {
    act();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('GamePhase', () => {
  it('should_allow_play_when_the_phase_is_playing', () => {
    expect(PlayingPhase.instance.canPlay()).toBe(true);
  });

  it('should_refuse_play_when_the_phase_is_not_playing', () => {
    const others = [
      ResolvingPhase.instance,
      PausedPhase.instance,
      GameOverPhase.instance,
      VictoryPhase.instance,
    ];

    expect(others.map((phase) => phase.canPlay())).toEqual([false, false, false, false]);
  });

  it('should_follow_the_outcome_when_a_turn_resolves', () => {
    const resolving = ResolvingPhase.instance;

    expect(resolving.after(Outcome.playing)).toBe(PlayingPhase.instance);
    expect(resolving.after(Outcome.victory)).toBe(VictoryPhase.instance);
    expect(resolving.after(Outcome.gameOver)).toBe(GameOverPhase.instance);
  });

  it('should_pause_and_resume_when_the_game_is_playing', () => {
    const paused = PlayingPhase.instance.pause();

    expect(paused).toBe(PausedPhase.instance);
    expect(paused.resume()).toBe(PlayingPhase.instance);
  });

  // A turn that resolves cannot pause: the phase stays resolving until the outcome arrives.
  it('should_stay_resolving_when_a_resolving_turn_is_paused', () => {
    expect(ResolvingPhase.instance.pause()).toBe(ResolvingPhase.instance);
    expect(ResolvingPhase.instance.resume()).toBe(ResolvingPhase.instance);
  });

  it('should_stay_ended_when_an_ended_game_is_paused_or_resumed', () => {
    expect(GameOverPhase.instance.pause()).toBe(GameOverPhase.instance);
    expect(VictoryPhase.instance.resume()).toBe(VictoryPhase.instance);
  });

  // Unit R18 of the redesign: the name of a phase is private. A phase names itself only
  // in the error of a move or an undo that it refuses.
  it('should_accept_a_move_and_an_undo_when_the_phase_is_playing', () => {
    expect(PlayingPhase.instance.checkAcceptsMove()).toBeUndefined();
    expect(PlayingPhase.instance.checkAcceptsUndo()).toBeUndefined();
  });

  it('should_throw_a_range_error_that_names_the_phase_when_a_phase_refuses_a_move', () => {
    const refusals = [
      ResolvingPhase.instance,
      PausedPhase.instance,
      GameOverPhase.instance,
      VictoryPhase.instance,
    ].map((phase) => thrownBy(() => phase.checkAcceptsMove()));

    expect(refusals).toEqual([
      new RangeError('The game cannot accept a move in the resolving phase.'),
      new RangeError('The game cannot accept a move in the paused phase.'),
      new RangeError('The game cannot accept a move in the game-over phase.'),
      new RangeError('The game cannot accept a move in the victory phase.'),
    ]);
  });

  it('should_throw_a_range_error_that_names_the_phase_when_a_phase_refuses_an_undo', () => {
    const refusals = [
      ResolvingPhase.instance,
      PausedPhase.instance,
      GameOverPhase.instance,
      VictoryPhase.instance,
    ].map((phase) => thrownBy(() => phase.checkAcceptsUndo()));

    expect(refusals).toEqual([
      new RangeError('The game cannot accept an undo in the resolving phase.'),
      new RangeError('The game cannot accept an undo in the paused phase.'),
      new RangeError('The game cannot accept an undo in the game-over phase.'),
      new RangeError('The game cannot accept an undo in the victory phase.'),
    ]);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails when it compiles.
  it('should_reject_at_compile_time_when_a_caller_reads_the_name_of_a_phase', () => {
    const phase: GamePhase = PlayingPhase.instance;
    const readers = [
      // @ts-expect-error `GamePhase` has no public name.
      () => phase.name,
      // @ts-expect-error `PlayingPhase` has no public name.
      () => PlayingPhase.instance.name,
      // @ts-expect-error `ResolvingPhase.name` is private.
      () => ResolvingPhase.instance.name,
      // @ts-expect-error `PausedPhase.name` is private.
      () => PausedPhase.instance.name,
      // @ts-expect-error `GameOverPhase.name` is private.
      () => GameOverPhase.instance.name,
      // @ts-expect-error `VictoryPhase.name` is private.
      () => VictoryPhase.instance.name,
    ];

    expect(readers).toHaveLength(6);
  });
});

describe('GameId', () => {
  it('should_keep_the_value_when_the_id_is_valid', () => {
    const id = GameId.of('hexa-lines');

    expect(id.equals(GameId.of('hexa-lines'))).toBe(true);
    expect(id.equals(GameId.of('hexa-line'))).toBe(false);
  });

  it('should_throw_when_the_id_is_empty', () => {
    expect(() => GameId.of('  ')).toThrow('empty');
  });

  it('should_throw_a_range_error_when_the_id_is_not_a_lowercase_kebab_case_slug', () => {
    const invalid = [
      'Hexa Fit',
      'hexa\tfit',
      'Hexa-Fit',
      '\thexa-fit',
      'hexa_fit',
      'hexa--fit',
      '-hexa',
    ];

    for (const value of invalid) {
      expect(() => GameId.of(value)).toThrow(RangeError);
      expect(() => GameId.of(value)).toThrow('lowercase kebab-case');
    }
  });

  it('should_keep_the_value_when_the_id_is_a_lowercase_kebab_case_slug', () => {
    const valid = [
      'hexa-lines',
      'hexa-fit',
      'hexa-sort',
      'hexa-merge',
      'hexa-fill',
      'fake-game',
      'game2',
    ];

    for (const value of valid) {
      expect(GameId.of(value).equals(GameId.of(value))).toBe(true);
    }
    // Each id keeps its own value, so no two ids of the list are equal.
    const ids = valid.map((value) => GameId.of(value));
    expect(ids.filter((id) => ids.filter((other) => other.equals(id)).length !== 1)).toEqual([]);
  });

  it('should_be_equal_when_two_ids_hold_the_same_value', () => {
    expect(GameId.of('hexa-fit').equals(GameId.of('hexa-fit'))).toBe(true);
    expect(GameId.of('hexa-fit').equals(GameId.of('hexa-sort'))).toBe(false);
  });
});

describe('GameOver event', () => {
  it('should_carry_the_game_the_match_the_outcome_and_the_final_score_when_it_is_created', () => {
    const event = new GameOver(
      GameId.of('hexa-lines'),
      MatchId.of('match-a'),
      Outcome.gameOver,
      Score.of(42),
    );

    expect(event.gameId.equals(GameId.of('hexa-lines'))).toBe(true);
    expect(event.matchId.equals(MatchId.of('match-a'))).toBe(true);
    expect(event.matchId.equals(MatchId.of('match-b'))).toBe(false);
    expect(event.outcome).toBe(Outcome.gameOver);
    expect(event.finalScore).toBeInstanceOf(Score);
    expect(event.finalScore.equals(Score.of(42))).toBe(true);
  });

  // The event has no check of its own: a `Score` is valid when it exists (issue #203).
  it('should_take_no_final_score_when_the_value_is_not_a_valid_score', () => {
    const gameId = GameId.of('hexa-lines');

    for (const score of [Number.NaN, Number.POSITIVE_INFINITY, -3, 0.5]) {
      expect(() => new GameOver(gameId, MATCH_ID, Outcome.gameOver, Score.of(score))).toThrow(
        new RangeError(`A score needs a whole number of 0 or more, not ${score}.`),
      );
    }
    expect(
      new GameOver(gameId, MATCH_ID, Outcome.gameOver, Score.of(0)).finalScore.equals(Score.of(0)),
    ).toBe(true);
  });
});
