/** @jest-environment node */
import { GameId } from '../../../src/domain/engine/game-id';
import { GameOver } from '../../../src/domain/engine/game-events';
import {
  GameOverPhase,
  PausedPhase,
  PlayingPhase,
  ResolvingPhase,
  VictoryPhase,
} from '../../../src/domain/engine/game-phase';

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

    expect(resolving.after('playing')).toBe(PlayingPhase.instance);
    expect(resolving.after('victory')).toBe(VictoryPhase.instance);
    expect(resolving.after('game-over')).toBe(GameOverPhase.instance);
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

  it('should_name_each_phase_when_the_name_is_read', () => {
    expect(PlayingPhase.instance.name).toBe('playing');
    expect(ResolvingPhase.instance.name).toBe('resolving');
    expect(PausedPhase.instance.name).toBe('paused');
    expect(GameOverPhase.instance.name).toBe('game-over');
    expect(VictoryPhase.instance.name).toBe('victory');
  });
});

describe('GameId', () => {
  it('should_keep_the_value_when_the_id_is_valid', () => {
    expect(GameId.of('hexa-lines').value).toBe('hexa-lines');
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

    expect(valid.map((value) => GameId.of(value).value)).toEqual(valid);
  });

  it('should_be_equal_when_two_ids_hold_the_same_value', () => {
    expect(GameId.of('hexa-fit').equals(GameId.of('hexa-fit'))).toBe(true);
    expect(GameId.of('hexa-fit').equals(GameId.of('hexa-sort'))).toBe(false);
  });
});

describe('GameOver event', () => {
  it('should_carry_the_game_the_outcome_and_the_final_score_when_it_is_created', () => {
    const event = new GameOver(GameId.of('hexa-lines'), 'game-over', 42);

    expect(event.gameId.value).toBe('hexa-lines');
    expect(event.outcome).toBe('game-over');
    expect(event.finalScore).toBe(42);
  });

  it('should_throw_a_range_error_when_the_final_score_is_not_finite', () => {
    const gameId = GameId.of('hexa-lines');

    for (const score of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => new GameOver(gameId, 'game-over', score)).toThrow(
        new RangeError('A game over event needs a final score that is a finite number.'),
      );
    }
    expect(new GameOver(gameId, 'game-over', -3).finalScore).toBe(-3);
  });
});
