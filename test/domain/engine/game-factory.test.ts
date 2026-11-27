/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/outcome';
import { Score } from '../../../src/domain/shared/score';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameFactory } from '../../../src/domain/engine/game-factory';
import { BoardId } from '../../../src/domain/engine/board-id';
import { GameId } from '../../../src/domain/shared/game-id';
import { GameStateId } from '../../../src/domain/engine/game-state-id';
import { MatchId } from '../../../src/domain/engine/match-id';
import type { MatchIdGenerator } from '../../../src/domain/engine/match-id-generator';
import { ElapsedTime } from '../../../src/domain/shared/elapsed-time';
import { LevelTimer } from '../../../src/domain/engine/level-timer';
import { LevelTimerId } from '../../../src/domain/engine/level-timer-id';
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
import { ManualClock } from '../../support/engine/manual-clock';
import { phaseNameOf } from '../../support/engine/phase-name';
import { square } from '../../support/engine/square-topology';
import { playMove } from '../../support/engine/play-move';

// `GameFactory` assembles the whole aggregate of one match (classes.md decision 40):
// the id of the match and the family of the variant. The game takes no publisher (#233).
// The variant factory of this suite exists only in test/ (APP-NFR-13).

const moveAt = (col: number): FakeMove => ({ at: square(col, 0), cell: fakeCell(1) });

// The id of the fake game. The composition root gives the id of the chosen game (issue #234).
const FAKE_GAME = GameId.of('fake-game');

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
    const games = new GameFactory(FAKE_GAME, fakeGameFactory(), new CountingMatchIds());

    const game = games.createGame();

    expect(phaseNameOf(game.currentPhase())).toBe('playing');
    expect(game.snapshot().boardCopy().occupiedCells()).toEqual([]);
    expect(game.offersUndo()).toBe(false);
    expect(game.elapsedTime()).toBeUndefined();
    expect(playMove(game, moveAt(0))).toBe(Outcome.playing);
    expect(game.snapshot().scoreSoFar()).toEqual(Score.of(1));
  });

  it('should_give_two_games_with_different_ids_and_boards_when_one_variant_starts_twice', () => {
    const games = new GameFactory(FAKE_GAME, fakeGameFactory(), new CountingMatchIds());

    const first = games.createGame();
    const second = games.createGame();
    playMove(first, moveAt(0));

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect(second.snapshot().boardCopy().occupiedCells()).toEqual([]);
  });

  it('should_give_each_game_a_first_state_of_its_own_match_when_a_game_is_created', () => {
    const games = new GameFactory(FAKE_GAME, fakeGameFactory(), new CountingMatchIds());

    const first = games.createGame().snapshot();
    const second = games.createGame().snapshot();

    expect([
      first.belongsTo(MatchId.of('match-1')),
      second.belongsTo(MatchId.of('match-2')),
    ]).toEqual([true, true]);
    expect([
      first.isPhotoOf(GameStateId.of(MatchId.of('match-2'))),
      first.belongsTo(MatchId.of('match-2')),
    ]).toEqual([false, false]);
  });

  it('should_give_the_engine_and_its_game_over_event_the_id_of_the_generator_when_the_generator_is_fixed', () => {
    const ids = new FixedMatchId();
    const game = new GameFactory(FAKE_GAME, fakeGameFactory(1), ids).createGame();
    const sameMatch = new GameEngine(
      MATCH_ID,
      GameId.of('another-game'),
      new FakeRules(),
      new OnePointScoring(),
    );

    playMove(game, moveAt(0));

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
    const games = new GameFactory(FAKE_GAME, fakeGameFactory(), ids);

    games.createGame();
    games.createGame();

    expect(ids.calls).toBe(2);
  });

  it('should_give_each_game_its_own_history_when_the_variant_has_undo', () => {
    const withUndo = {
      ...fakeGameFactory(),
      createHistory: () => new MoveHistory<FakeMove, FakeSnapshot>(),
    };
    const games = new GameFactory(FAKE_GAME, withUndo, new CountingMatchIds());
    const first = games.createGame();
    const second = games.createGame();

    playMove(first, moveAt(0));

    expect([first.canUndo(), second.canUndo()]).toEqual([true, false]);
    first.undo();
    expect(first.snapshot().boardCopy().occupiedCells()).toEqual([]);
  });

  it('should_throw_the_error_of_the_generator_when_the_generator_gives_no_id', () => {
    const games = new GameFactory(FAKE_GAME, fakeGameFactory(), {
      next: () => {
        throw new Error('The generator has no id.');
      },
    });

    expect(() => games.createGame()).toThrow('The generator has no id.');
  });

  // The state and its board are entities with local ids (classes.md decisions 7, 26 and 52).
  // The factory builds each id from the `MatchId` of the game (issue #236).
  it('should_give_the_first_state_and_its_board_the_ids_of_the_match_when_a_game_is_created', () => {
    const games = new GameFactory(FAKE_GAME, fakeGameFactory(), new CountingMatchIds());
    // A state of the match `name` whose state and board hold the ids of that match.
    const stateOf = (name: string) => {
      const match = MatchId.of(name);
      return emptyState(2, match, GameStateId.of(match), BoardId.of(match));
    };
    // The id of the state of the match `name`. The photo keeps its ids private (issue #245),
    // so the test asks the photo whether it shows the state of this id.
    const stateIdOf = (name: string) => GameStateId.of(MatchId.of(name));

    const first = games.createGame().snapshot();
    const second = games.createGame().snapshot();

    expect([
      first.isPhotoOf(stateIdOf('match-1')),
      first.boardCopy().equals(stateOf('match-1').board),
      second.isPhotoOf(stateIdOf('match-2')),
      second.boardCopy().equals(stateOf('match-2').board),
    ]).toEqual([true, true, true, true]);
    expect([first.isPhotoOf(stateIdOf('match-2')), second.isPhotoOf(stateIdOf('match-1'))]).toEqual(
      [false, false],
    );
    expect([
      first.boardCopy().equals(second.boardCopy()),
      second.boardCopy().equals(first.boardCopy()),
    ]).toEqual([false, false]);
  });

  // A timed variant builds the id of its timer from the `MatchId` (classes.md decision 50).
  it('should_give_the_variant_timer_the_match_id_of_the_game_when_a_game_is_created', () => {
    const seen: MatchId[] = [];
    const recording = {
      ...fakeGameFactory(),
      createTimer: (matchId: MatchId) => {
        seen.push(matchId);
        return undefined;
      },
    };
    const games = new GameFactory(FAKE_GAME, recording, new CountingMatchIds());

    games.createGame();
    games.createGame();

    expect(seen).toHaveLength(2);
    expect([
      seen[0]?.equals(MatchId.of('match-1')),
      seen[1]?.equals(MatchId.of('match-2')),
    ]).toEqual([true, true]);
  });

  // The variant factory gives the timer as an optional part, as it gives the history.
  // `GameFactory` wraps the rules in `TimedRulesDecorator` with that timer and gives the
  // same timer to the root (issue #234, classes.md decisions 19 and 27).
  it('should_time_each_game_with_its_own_timer_when_the_variant_factory_gives_one', () => {
    const clock = new ManualClock();
    const timed = {
      ...fakeGameFactory(),
      createTimer: (matchId: MatchId) => new LevelTimer(LevelTimerId.of(matchId), clock),
    };
    const games = new GameFactory(FAKE_GAME, timed, new CountingMatchIds());
    const first = games.createGame();
    const second = games.createGame();
    // The time before the first turn does not count.
    clock.advance(5_000);

    playMove(first, moveAt(0));
    clock.advance(1_000);

    expect(first.elapsedTime()).toEqual(ElapsedTime.ofMs(1_000));
    expect(second.elapsedTime()).toEqual(ElapsedTime.ofMs(0));
  });
});
