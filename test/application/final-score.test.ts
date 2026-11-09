/** @jest-environment node */
import { ApplyMove } from '../../src/application/apply-move';
import { GameEngine } from '../../src/domain/engine/game-engine';
import { GameId } from '../../src/domain/engine/game-id';
import { MemoryRunningGameStore, valueOf } from '../support/application/game-use-cases';
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

// The points of each turn are finite, but their total can pass the largest number.
class HugeScoring extends OnePointScoring {
  override score(): number {
    return Number.MAX_VALUE;
  }
}

// One cell and the largest score: the only move ends the game with a total that is not finite.
function overflowingGame() {
  const games = new MemoryRunningGameStore<FakeCell, SquareCoord, FakeMove, FakeState>();
  const publisher = new RecordingPublisher();
  const engine = new GameEngine(
    GameId.of('fake-game'),
    new FakeRules(),
    new HugeScoring(),
    publisher,
  );
  const state = emptyState(1);
  state.score = Number.MAX_VALUE;
  engine.start(state);
  games.replace(engine);
  const logger = new RecordingLogger();
  return { engine, publisher, logger, applyMove: new ApplyMove(games, logger) };
}

const MOVE: FakeMove = { at: square(0, 0), cell: fakeCell(1) };

describe('a final score that is not finite', () => {
  it('should_return_the_same_move_result_when_the_total_score_passes_the_largest_number', async () => {
    const { applyMove } = overflowingGame();

    const played = valueOf(await applyMove.execute({ move: MOVE }));

    expect(played).toEqual({
      cells: [[square(0, 0), fakeCell(1)]],
      score: Number.POSITIVE_INFINITY,
      outcome: 'game-over',
      canUndo: false,
      canRedo: false,
      hasUndo: false,
      payload: { filled: 1 },
    });
  });

  it('should_log_a_publish_failure_and_keep_the_turn_when_the_total_score_passes_the_largest_number', async () => {
    const { engine, publisher, logger, applyMove } = overflowingGame();

    await applyMove.execute({ move: MOVE });

    expect(publisher.events).toEqual([]);
    expect(logger.entries.map((entry) => entry.error?.code)).toEqual(['publish-failed']);
    expect(engine.snapshot().score).toBe(Number.POSITIVE_INFINITY);
    expect(engine.currentPhase().name).toBe('game-over');
  });
});
