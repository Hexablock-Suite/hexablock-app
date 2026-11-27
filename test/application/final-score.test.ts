/** @jest-environment node */
import { ApplyMove } from '../../src/application/apply-move';
import { GameEngine } from '../../src/domain/engine/game-engine';
import { GameId } from '../../src/domain/shared/game-id';
import { PlayingPhase } from '../../src/domain/engine/game-phase';
import { Score } from '../../src/domain/shared/score';
import { errorOf, MemoryGameRepository } from '../support/application/game-use-cases';
import { RecordingPublisher } from '../support/application/recording-publisher';
import { fakeCell, type FakeCell } from '../support/engine/fake-cell';
import {
  emptyState,
  FakeRules,
  OnePointScoring,
  type FakeMove,
  type FakeState,
} from '../support/engine/fake-game';
import { square, type SquareCoord } from '../support/engine/square-topology';
import { MATCH_ID } from '../support/engine/match-id';
import { playMove } from '../support/engine/play-move';

// The score of the state is the largest safe integer, so one more point passes it.
const FULL = Score.of(Number.MAX_SAFE_INTEGER);

// One cell and the largest score: the only move would end the game with a total
// that is not a valid score.
function overflowingGame() {
  const games = new MemoryGameRepository<FakeCell, SquareCoord, FakeMove, FakeState>();
  const publisher = new RecordingPublisher();
  const engine = new GameEngine(
    MATCH_ID,
    GameId.of('fake-game'),
    new FakeRules(),
    new OnePointScoring(),
  );
  const state = emptyState(1);
  state.addPoints(FULL);
  engine.start(state);
  games.replace(engine);
  return { engine, publisher, applyMove: new ApplyMove(games, publisher) };
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
    const { engine, publisher, applyMove } = overflowingGame();

    await applyMove.execute({ move: MOVE });

    const after = engine.snapshot();
    expect(after.boardCopy().occupiedCells()).toEqual([]);
    expect(after.scoreSoFar()).toEqual(FULL);
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(publisher.events).toEqual([]);
  });

  it('should_throw_a_range_error_and_keep_the_game_when_the_engine_plays_that_turn', () => {
    const { engine } = overflowingGame();

    expect(() => playMove(engine, MOVE)).toThrow(
      new RangeError('The sum of two scores cannot pass the largest safe integer.'),
    );

    expect(engine.snapshot().scoreSoFar()).toEqual(FULL);
    expect(engine.snapshot().boardCopy().occupiedCells()).toEqual([]);
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(engine.takeEvents()).toEqual([]);
  });
});
