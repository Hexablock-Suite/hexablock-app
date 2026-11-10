/** @jest-environment node */
import { ApplyMove } from '../../src/application/apply-move';
import { GameEngine } from '../../src/domain/engine/game-engine';
import { GameId } from '../../src/domain/engine/game-id';
import { PlayingPhase } from '../../src/domain/engine/game-phase';
import { Score } from '../../src/domain/engine/score';
import { errorOf, MemoryRunningGameStore } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { fakeCell, type FakeCell } from '../support/engine/fake-cell';
import {
  emptyState,
  FakeRules,
  OnePointScoring,
  RecordingPublisher,
  type FakeMove,
  type FakeState,
} from '../support/engine/fake-game';
import { square, type SquareCoord } from '../support/engine/square-topology';
import { MATCH_ID } from '../support/engine/match-id';

// The score of the state is the largest safe integer, so one more point passes it.
const FULL = Score.of(Number.MAX_SAFE_INTEGER);

// One cell and the largest score: the only move would end the game with a total
// that is not a valid score.
function overflowingGame() {
  const games = new MemoryRunningGameStore<FakeCell, SquareCoord, FakeMove, FakeState>();
  const publisher = new RecordingPublisher();
  const engine = new GameEngine(
    MATCH_ID,
    GameId.of('fake-game'),
    new FakeRules(),
    new OnePointScoring(),
    publisher,
  );
  const state = emptyState(1);
  state.addPoints(FULL);
  engine.start(state);
  games.replace(engine);
  const logger = new RecordingLogger();
  return { engine, publisher, logger, applyMove: new ApplyMove(games, logger) };
}

const MOVE: FakeMove = { at: square(0, 0), cell: fakeCell(1) };

// Before issue #203 the total became `Infinity`, the turn stayed saved and the `GameOver`
// event threw. A `Score` checks its sum, so the turn now throws before the engine saves it.
describe('a total score that passes the largest safe integer', () => {
  it('should_return_a_move_failed_error_when_the_points_of_the_turn_pass_the_largest_safe_integer', async () => {
    const { applyMove } = overflowingGame();

    const error = errorOf(await applyMove.execute({ move: MOVE }));

    expect([error.code, error.message]).toEqual([
      'move-failed',
      'The sum of two scores cannot pass the largest safe integer.',
    ]);
  });

  it('should_leave_the_turn_unsaved_when_the_points_of_the_turn_pass_the_largest_safe_integer', async () => {
    const { engine, publisher, logger, applyMove } = overflowingGame();

    await applyMove.execute({ move: MOVE });

    const after = engine.snapshot();
    expect(after.board.cells()).toEqual([]);
    expect(after.score).toEqual(FULL);
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(publisher.events).toEqual([]);
    expect(logger.entries).toEqual([]);
  });

  it('should_throw_a_range_error_and_keep_the_game_when_the_engine_plays_that_turn', () => {
    const { engine, publisher } = overflowingGame();

    expect(() => engine.play(MOVE)).toThrow(
      new RangeError('The sum of two scores cannot pass the largest safe integer.'),
    );

    expect(engine.snapshot().score).toEqual(FULL);
    expect(engine.snapshot().board.cells()).toEqual([]);
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(publisher.events).toEqual([]);
  });
});
