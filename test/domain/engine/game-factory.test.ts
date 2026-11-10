/** @jest-environment node */
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameOver } from '../../../src/domain/engine/game-events';
import { GameFactory } from '../../../src/domain/engine/game-factory';
import { GameId } from '../../../src/domain/engine/game-id';
import { MatchId } from '../../../src/domain/engine/match-id';
import type { MatchIdGenerator } from '../../../src/domain/engine/match-id-generator';
import { MoveHistory } from '../../../src/domain/engine/move-history';
import { fakeCell } from '../../support/engine/fake-cell';
import {
  fakeGameFactory,
  FakeRules,
  OnePointScoring,
  RecordingPublisher,
  type FakeMove,
  type FakeState,
} from '../../support/engine/fake-game';
import { CountingMatchIds, MATCH_ID } from '../../support/engine/match-id';
import { phaseNameOf } from '../../support/engine/phase-name';
import { square } from '../../support/engine/square-topology';

// `GameFactory` assembles the whole aggregate of one match (classes.md decision 40):
// the id of the match, the family of the variant and the event publisher.
// The variant factory of this suite exists only in test/ (APP-NFR-13).

const moveAt = (col: number): FakeMove => ({ at: square(col, 0), cell: fakeCell(1) });

// A generator double that always gives the same id and counts its calls.
class FixedMatchId implements MatchIdGenerator {
  calls = 0;

  next(): MatchId {
    this.calls += 1;
    return MATCH_ID;
  }
}

describe('GameFactory', () => {
  it('should_give_a_started_game_of_the_variant_when_a_game_is_created', () => {
    const games = new GameFactory(
      fakeGameFactory(),
      new CountingMatchIds(),
      new RecordingPublisher(),
    );

    const game = games.createGame();

    expect(phaseNameOf(game.currentPhase())).toBe('playing');
    expect(game.snapshot().board.cells()).toEqual([]);
    expect(game.undoable()).toBeUndefined();
    expect(game.play(moveAt(0))).toBe('playing');
    expect(game.snapshot().score).toBe(1);
  });

  it('should_give_two_games_with_different_ids_and_boards_when_one_variant_starts_twice', () => {
    const games = new GameFactory(
      fakeGameFactory(),
      new CountingMatchIds(),
      new RecordingPublisher(),
    );

    const first = games.createGame();
    const second = games.createGame();
    first.play(moveAt(0));

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect(second.snapshot().board.cells()).toEqual([]);
  });

  it('should_give_each_game_a_first_state_of_its_own_match_when_a_game_is_created', () => {
    const games = new GameFactory(
      fakeGameFactory(),
      new CountingMatchIds(),
      new RecordingPublisher(),
    );

    const first = games.createGame().snapshot();
    const second = games.createGame().snapshot();

    expect([
      first.belongsTo(MatchId.of('match-1')),
      second.belongsTo(MatchId.of('match-2')),
    ]).toEqual([true, true]);
    expect([first.equals(second), first.belongsTo(MatchId.of('match-2'))]).toEqual([false, false]);
  });

  it('should_give_the_engine_and_its_game_over_event_the_id_of_the_generator_when_the_generator_is_fixed', () => {
    const publisher = new RecordingPublisher();
    const ids = new FixedMatchId();
    const game = new GameFactory(fakeGameFactory(1), ids, publisher).createGame();
    const sameMatch = new GameEngine(
      MATCH_ID,
      GameId.of('another-game'),
      new FakeRules(),
      new OnePointScoring(),
      new RecordingPublisher(),
    );

    game.play(moveAt(0));

    expect(ids.calls).toBe(1);
    expect(game.equals(sameMatch)).toBe(true);
    expect(publisher.events).toEqual([
      new GameOver(GameId.of('fake-game'), MATCH_ID, 'game-over', 1),
    ]);
  });

  it('should_ask_the_generator_once_when_each_game_is_created', () => {
    const ids = new FixedMatchId();
    const games = new GameFactory(fakeGameFactory(), ids, new RecordingPublisher());

    games.createGame();
    games.createGame();

    expect(ids.calls).toBe(2);
  });

  it('should_give_each_game_its_own_history_when_the_variant_has_undo', () => {
    const withUndo = {
      ...fakeGameFactory(),
      createHistory: () => new MoveHistory<FakeMove, FakeState>(),
    };
    const games = new GameFactory(withUndo, new CountingMatchIds(), new RecordingPublisher());
    const first = games.createGame();
    const second = games.createGame();

    first.play(moveAt(0));

    expect([first.undoable()?.canUndo(), second.undoable()?.canUndo()]).toEqual([true, false]);
    first.undoable()?.undo();
    expect(first.snapshot().board.cells()).toEqual([]);
  });

  it('should_throw_the_error_of_the_generator_when_the_generator_gives_no_id', () => {
    const games = new GameFactory(
      fakeGameFactory(),
      {
        next: () => {
          throw new Error('The generator has no id.');
        },
      },
      new RecordingPublisher(),
    );

    expect(() => games.createGame()).toThrow('The generator has no id.');
  });
});
