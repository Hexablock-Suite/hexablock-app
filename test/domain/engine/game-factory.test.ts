/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/outcome';
import { Score } from '../../../src/domain/engine/score';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameFactory } from '../../../src/domain/engine/game-factory';
import { BoardId } from '../../../src/domain/engine/board-id';
import { GameId } from '../../../src/domain/engine/game-id';
import { GameStateId } from '../../../src/domain/engine/game-state-id';
import { MatchId } from '../../../src/domain/engine/match-id';
import type { MatchIdGenerator } from '../../../src/domain/engine/match-id-generator';
import { MoveHistory } from '../../../src/domain/engine/move-history';
import { fakeCell } from '../../support/engine/fake-cell';
import {
  fakeGameFactory,
  FakeRules,
  OnePointScoring,
  emptyState,
  type FakeMove,
  type FakeSnapshot,
} from '../../support/engine/fake-game';
import { CountingMatchIds, MATCH_ID } from '../../support/engine/match-id';
import { dataOf } from '../../support/engine/game-over';
import { phaseNameOf } from '../../support/engine/phase-name';
import { square } from '../../support/engine/square-topology';

// `GameFactory` assembles the whole aggregate of one match (classes.md decision 40):
// the id of the match and the family of the variant. The game takes no publisher (#233).
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
    const games = new GameFactory(fakeGameFactory(), new CountingMatchIds());

    const game = games.createGame();

    expect(phaseNameOf(game.currentPhase())).toBe('playing');
    expect(game.snapshot().board.cells()).toEqual([]);
    expect(game.undoable()).toBeUndefined();
    expect(game.play(moveAt(0))).toBe(Outcome.playing);
    expect(game.snapshot().score).toEqual(Score.of(1));
  });

  it('should_give_two_games_with_different_ids_and_boards_when_one_variant_starts_twice', () => {
    const games = new GameFactory(fakeGameFactory(), new CountingMatchIds());

    const first = games.createGame();
    const second = games.createGame();
    first.play(moveAt(0));

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect(second.snapshot().board.cells()).toEqual([]);
  });

  it('should_give_each_game_a_first_state_of_its_own_match_when_a_game_is_created', () => {
    const games = new GameFactory(fakeGameFactory(), new CountingMatchIds());

    const first = games.createGame().snapshot();
    const second = games.createGame().snapshot();

    expect([
      first.matchId.equals(MatchId.of('match-1')),
      second.matchId.equals(MatchId.of('match-2')),
    ]).toEqual([true, true]);
    expect([
      first.stateId.equals(second.stateId),
      first.matchId.equals(MatchId.of('match-2')),
    ]).toEqual([false, false]);
  });

  it('should_give_the_engine_and_its_game_over_event_the_id_of_the_generator_when_the_generator_is_fixed', () => {
    const ids = new FixedMatchId();
    const game = new GameFactory(fakeGameFactory(1), ids).createGame();
    const sameMatch = new GameEngine(
      MATCH_ID,
      GameId.of('another-game'),
      new FakeRules(),
      new OnePointScoring(),
    );

    game.play(moveAt(0));

    expect(ids.calls).toBe(1);
    expect(game.equals(sameMatch)).toBe(true);
    expect(game.takeEvents().map(dataOf)).toEqual([
      {
        gameId: GameId.of('fake-game'),
        matchId: MATCH_ID,
        outcome: Outcome.gameOver,
        finalScore: Score.of(1),
      },
    ]);
  });

  it('should_ask_the_generator_once_when_each_game_is_created', () => {
    const ids = new FixedMatchId();
    const games = new GameFactory(fakeGameFactory(), ids);

    games.createGame();
    games.createGame();

    expect(ids.calls).toBe(2);
  });

  it('should_give_each_game_its_own_history_when_the_variant_has_undo', () => {
    const withUndo = {
      ...fakeGameFactory(),
      createHistory: () => new MoveHistory<FakeMove, FakeSnapshot>(),
    };
    const games = new GameFactory(withUndo, new CountingMatchIds());
    const first = games.createGame();
    const second = games.createGame();

    first.play(moveAt(0));

    expect([first.undoable()?.canUndo(), second.undoable()?.canUndo()]).toEqual([true, false]);
    first.undoable()?.undo();
    expect(first.snapshot().board.cells()).toEqual([]);
  });

  it('should_throw_the_error_of_the_generator_when_the_generator_gives_no_id', () => {
    const games = new GameFactory(fakeGameFactory(), {
      next: () => {
        throw new Error('The generator has no id.');
      },
    });

    expect(() => games.createGame()).toThrow('The generator has no id.');
  });

  // The state and its board are entities with local ids (classes.md decisions 7, 26 and 52).
  // The factory builds each id from the `MatchId` of the game (issue #236).
  it('should_give_the_first_state_and_its_board_the_ids_of_the_match_when_a_game_is_created', () => {
    const games = new GameFactory(fakeGameFactory(), new CountingMatchIds());
    // A state of the match `name` whose state and board hold the ids of that match.
    const stateOf = (name: string) => {
      const match = MatchId.of(name);
      return emptyState(2, match, GameStateId.of(match), BoardId.of(match));
    };

    const first = games.createGame().snapshot();
    const second = games.createGame().snapshot();

    expect([
      first.stateId.equals(stateOf('match-1').snapshot().stateId),
      first.board.equals(stateOf('match-1').board),
      second.stateId.equals(stateOf('match-2').snapshot().stateId),
      second.board.equals(stateOf('match-2').board),
    ]).toEqual([true, true, true, true]);
    expect([first.stateId.equals(second.stateId), second.stateId.equals(first.stateId)]).toEqual([
      false,
      false,
    ]);
    expect([first.board.equals(second.board), second.board.equals(first.board)]).toEqual([
      false,
      false,
    ]);
  });

  // A timed variant builds the id of its timer from the `MatchId` (classes.md decision 50).
  it('should_give_the_variant_rules_the_match_id_of_the_game_when_a_game_is_created', () => {
    const seen: MatchId[] = [];
    const recording = {
      ...fakeGameFactory(),
      createRules: (matchId: MatchId) => {
        seen.push(matchId);
        return new FakeRules();
      },
    };
    const games = new GameFactory(recording, new CountingMatchIds());

    games.createGame();
    games.createGame();

    expect(seen).toHaveLength(2);
    expect([
      seen[0]?.equals(MatchId.of('match-1')),
      seen[1]?.equals(MatchId.of('match-2')),
    ]).toEqual([true, true]);
  });
});
