/** @jest-environment node */
import { GameEngine } from '../../../src/domain/engine/game-engine';
import {
  GameOver,
  type GameEvent,
  type GameEventPublisher,
} from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/engine/game-id';
import { GameOverPhase } from '../../../src/domain/engine/game-phase';
import type { Outcome } from '../../../src/domain/engine/outcome';
import type { IPieceSource } from '../../../src/domain/engine/piece-source';
import {
  GameResult,
  ProgressRecord,
  type IProgressModel,
} from '../../../src/domain/engine/progress-model';
import type { IScoringPolicy } from '../../../src/domain/engine/scoring-policy';
import { fakeCell, type FakeCell } from '../../support/engine/fake-cell';
import {
  SourceRules,
  sourceState,
  type SourceSnapshot,
  type SourceState,
} from '../../support/engine/fake-game';
import { square, type SquareCoord } from '../../support/engine/square-topology';
import { MATCH_ID } from '../../support/engine/match-id';

// APP-NFR-04: the piece source, the scoring policy and the progress model swap,
// and no engine file changes. Every implementation here is a dummy that exists only in test/.
// No real scoring: the accepted rule of issue #59 (D22) has its own suite per variant.
// Each dummy runs through `GameEngine`: the source lives in the state that the engine
// copies and rolls back, the engine calls the scoring, and a subscriber of the
// `GameOver` event gives a `GameResult` to the progress model.

// Dummy piece sources: both endless, each with its own sequence of cell values.
// `clone()` copies the position, so a clone gives the same next pieces.
class CountingSource implements IPieceSource<FakeCell> {
  constructor(private value = 0) {}
  hasNext(): boolean {
    return true;
  }
  next(): FakeCell {
    this.value += 1;
    return fakeCell(this.value);
  }
  clone(): CountingSource {
    return new CountingSource(this.value);
  }
  *[Symbol.iterator](): Iterator<FakeCell> {
    while (this.hasNext()) yield this.next();
  }
}

class ConstantSource implements IPieceSource<FakeCell> {
  hasNext(): boolean {
    return true;
  }
  next(): FakeCell {
    return fakeCell(9);
  }
  clone(): ConstantSource {
    return new ConstantSource();
  }
  *[Symbol.iterator](): Iterator<FakeCell> {
    while (this.hasNext()) yield this.next();
  }
}

// Dummy scoring policies.
class OnePerMove implements IScoringPolicy<SourceState> {
  score(): number {
    return 1;
  }
}

// The value of the cell that the move filled: the cell that `before` does not have.
class CellValue implements IScoringPolicy<SourceState> {
  score(before: SourceSnapshot, after: SourceSnapshot): number {
    const placed = after.board.cells().find(([at]) => before.board.get(at) === undefined);
    return placed?.[1].value ?? 0;
  }
}

// Dummy progress models.
class ScoreProgress implements IProgressModel {
  record(result: GameResult): ProgressRecord {
    return ProgressRecord.of({ gameId: result.gameId, score: result.score });
  }
}

class MovesProgress implements IProgressModel {
  record(result: GameResult): ProgressRecord {
    return ProgressRecord.of({ gameId: result.gameId, score: result.moves });
  }
}

// A subscriber of the engine events. On `GameOver` it builds a `GameResult`
// and gives it to the progress model.
class ProgressSubscriber implements GameEventPublisher {
  readonly records: ProgressRecord[] = [];

  constructor(
    private readonly progress: IProgressModel,
    private readonly moves: () => number,
  ) {}

  publish(event: GameEvent): void {
    if (!(event instanceof GameOver)) return;
    const result = GameResult.of({
      gameId: event.gameId,
      score: event.finalScore,
      moves: this.moves(),
    });
    this.records.push(this.progress.record(result));
  }
}

// Rules whose first `apply()` throws after the draw from `state.source`.
class FailingOnceRules extends SourceRules {
  private failed = false;

  override apply(state: SourceState, at: SquareCoord): SourceState {
    const next = super.apply(state, at);
    if (!this.failed) {
      this.failed = true;
      throw new Error('apply failed');
    }
    return next;
  }
}

const sources = {
  counting: () => new CountingSource(),
  constant: () => new ConstantSource(),
};

const scorings = {
  one_per_move: () => new OnePerMove(),
  cell_value: () => new CellValue(),
};

// One function plays every combination: the engine code is the same for all of them.
function playGame(
  source: IPieceSource<FakeCell>,
  scoring: IScoringPolicy<SourceState>,
  progress: IProgressModel,
  rules: SourceRules = new SourceRules(),
) {
  let moves = 0;
  const subscriber = new ProgressSubscriber(progress, () => moves);
  const engine = new GameEngine(MATCH_ID, GameId.of('fake-game'), rules, scoring, subscriber);
  engine.start(sourceState(source));
  let outcome: Outcome = 'playing';
  for (const at of sourceState(source).board.shape.cells) {
    // The count includes this move, because `play()` publishes `GameOver` before it returns.
    moves += 1;
    // A turn that throws is played once more.
    try {
      outcome = engine.play(at);
    } catch {
      outcome = engine.play(at);
    }
  }
  return { outcome, state: engine.snapshot(), records: subscriber.records };
}

describe('swapping the piece source, the scoring policy and the progress model', () => {
  it('should_place_the_pieces_of_each_source_when_the_source_is_swapped', () => {
    const counting = playGame(sources.counting(), new OnePerMove(), new ScoreProgress());
    const constant = playGame(sources.constant(), new OnePerMove(), new ScoreProgress());

    expect(counting.state.board.cells().map(([, cell]) => cell.value)).toEqual([1, 2, 3, 4]);
    expect(constant.state.board.cells().map(([, cell]) => cell.value)).toEqual([9, 9, 9, 9]);
  });

  it('should_give_the_score_of_each_policy_when_the_scoring_is_swapped', () => {
    const perMove = playGame(sources.counting(), new OnePerMove(), new ScoreProgress());
    const byValue = playGame(sources.counting(), new CellValue(), new ScoreProgress());

    expect(perMove.state.score).toBe(4);
    expect(byValue.state.score).toBe(1 + 2 + 3 + 4);
  });

  it('should_give_the_record_of_each_model_when_the_progress_model_is_swapped', () => {
    const byScore = playGame(sources.constant(), new CellValue(), new ScoreProgress());
    const byMoves = playGame(sources.constant(), new CellValue(), new MovesProgress());

    expect(byScore.records.map((record) => record.score)).toEqual([36]);
    expect(byMoves.records.map((record) => record.score)).toEqual([4]);
    expect(byMoves.records[0]?.gameId.equals(GameId.of('fake-game'))).toBe(true);
  });

  it('should_place_the_same_pieces_when_a_turn_throws_with_each_source', () => {
    for (const make of [sources.counting, sources.constant]) {
      const plain = playGame(make(), new OnePerMove(), new ScoreProgress());
      const retried = playGame(
        make(),
        new OnePerMove(),
        new ScoreProgress(),
        new FailingOnceRules(),
      );

      expect(retried.state.board.cells()).toEqual(plain.state.board.cells());
      expect(retried.state.score).toBe(plain.state.score);
      expect(retried.records.map((record) => record.score)).toEqual([4]);
    }
  });

  const combinations = [
    ['counting', 'one_per_move', 'score'],
    ['counting', 'cell_value', 'moves'],
    ['constant', 'one_per_move', 'moves'],
    ['constant', 'cell_value', 'score'],
  ] as const;
  for (const [source, scoring, progress] of combinations) {
    it(`should_end_the_game_when_the_board_fills_with_${source}_${scoring}_${progress}`, () => {
      const game = playGame(
        sources[source](),
        scorings[scoring](),
        progress === 'score' ? new ScoreProgress() : new MovesProgress(),
      );

      expect(game.outcome).toBe('game-over');
      expect(game.records).toHaveLength(1);
    });
  }

  it('should_reject_a_fifth_move_and_keep_the_state_when_the_board_is_full', () => {
    const subscriber = new ProgressSubscriber(new ScoreProgress(), () => 4);
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new SourceRules(),
      new OnePerMove(),
      subscriber,
    );
    engine.start(sourceState(sources.counting()));
    for (const at of sourceState(sources.counting()).board.shape.cells) engine.play(at);
    const full = engine.snapshot();

    expect(() => engine.play(square(0, 0))).toThrow(RangeError);
    expect(() => engine.play(square(0, 0))).toThrow('game-over phase');
    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
    expect(engine.snapshot().board.cells()).toEqual(full.board.cells());
    expect(engine.snapshot().score).toBe(full.score);
    expect(subscriber.records).toHaveLength(1);
  });
});

describe('GameResult and ProgressRecord', () => {
  it('should_throw_when_a_result_has_negative_moves', () => {
    expect(() => GameResult.of({ gameId: GameId.of('fake-game'), score: 0, moves: -1 })).toThrow(
      'moves',
    );
  });

  it('should_throw_when_a_result_has_a_negative_time', () => {
    const gameId = GameId.of('fake-game');

    expect(() => GameResult.of({ gameId, score: 0, moves: 0, elapsedMs: -1 })).toThrow(
      'milliseconds',
    );
    expect(GameResult.of({ gameId, score: 0, moves: 0, elapsedMs: 0 }).elapsedMs).toBe(0);
  });

  it('should_throw_a_range_error_when_a_result_has_a_decimal_number_of_moves', () => {
    const gameId = GameId.of('fake-game');

    expect(() => GameResult.of({ gameId, score: 0, moves: 2.5 })).toThrow(RangeError);
    expect(() => GameResult.of({ gameId, score: 0, moves: 2.5 })).toThrow('moves');
  });

  it('should_throw_a_range_error_when_a_result_has_a_score_that_is_not_a_number', () => {
    const gameId = GameId.of('fake-game');

    expect(() => GameResult.of({ gameId, score: Number.NaN, moves: 0 })).toThrow(RangeError);
    expect(() => GameResult.of({ gameId, score: Number.NaN, moves: 0 })).toThrow('score');
  });

  it('should_throw_a_range_error_when_a_result_has_a_time_that_is_not_a_number', () => {
    const gameId = GameId.of('fake-game');

    expect(() => GameResult.of({ gameId, score: 0, moves: 0, elapsedMs: Number.NaN })).toThrow(
      RangeError,
    );
    expect(() => GameResult.of({ gameId, score: 0, moves: 0, elapsedMs: Number.NaN })).toThrow(
      'milliseconds',
    );
  });

  it('should_throw_a_range_error_when_a_result_has_an_infinite_score_or_time', () => {
    const gameId = GameId.of('fake-game');

    for (const score of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => GameResult.of({ gameId, score, moves: 0 })).toThrow('score');
    }
    expect(() =>
      GameResult.of({ gameId, score: 0, moves: 0, elapsedMs: Number.POSITIVE_INFINITY }),
    ).toThrow('milliseconds');
  });

  it('should_throw_a_range_error_when_a_record_has_negative_stars', () => {
    const gameId = GameId.of('fake-game');

    expect(() => ProgressRecord.of({ gameId, score: 0, stars: -1 })).toThrow(RangeError);
    expect(() => ProgressRecord.of({ gameId, score: 0, stars: -1 })).toThrow('stars');
    expect(ProgressRecord.of({ gameId, score: 0, stars: 0 }).stars).toBe(0);
  });

  it('should_keep_the_optional_fields_when_a_result_has_a_level_and_a_time', () => {
    const result = GameResult.of({
      gameId: GameId.of('hexa-fit'),
      levelId: 'fit-01',
      score: 0,
      moves: 12,
      elapsedMs: 3000,
    });

    expect(result.levelId).toBe('fit-01');
    expect(result.elapsedMs).toBe(3000);
  });
});
