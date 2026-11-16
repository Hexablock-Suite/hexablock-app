/** @jest-environment node */
import { Score } from '../../../src/domain/engine/score';
import { ElapsedTime } from '../../../src/domain/engine/elapsed-time';
import { LevelId } from '../../../src/domain/engine/level-id';
import { Moves } from '../../../src/domain/engine/moves';
import { Stars } from '../../../src/domain/engine/stars';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import {
  GameOver,
  type GameEvent,
  type GameOverReceiver,
} from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/engine/game-id';
import { GameProgress } from '../../../src/domain/engine/game-progress';
import type { MatchId } from '../../../src/domain/engine/match-id';
import { GameOverPhase } from '../../../src/domain/engine/game-phase';
import { Outcome } from '../../../src/domain/engine/outcome';
import {
  piecesFrom,
  type IPieceSource,
  type PieceDraw,
} from '../../../src/domain/engine/piece-source';
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
// `GameOver` event gives a `GameResult` to the progress model. The engine records the event,
// and the subscriber takes it after each move, as `ApplyMove` does (issue #233).
// The model records the result in the progress of the game (issue #156).

// Dummy piece sources: both endless, each with its own sequence of cell values.
// Each one is a value: `take()` returns the piece and the next source, and changes nothing.
class CountingSource implements IPieceSource<FakeCell> {
  constructor(private readonly value = 0) {}
  hasNext(): boolean {
    return true;
  }
  take(): PieceDraw<FakeCell> {
    return [fakeCell(this.value + 1), new CountingSource(this.value + 1)];
  }
  [Symbol.iterator](): Iterator<FakeCell> {
    return piecesFrom(this);
  }
}

class ConstantSource implements IPieceSource<FakeCell> {
  hasNext(): boolean {
    return true;
  }
  take(): PieceDraw<FakeCell> {
    return [fakeCell(9), this];
  }
  [Symbol.iterator](): Iterator<FakeCell> {
    return piecesFrom(this);
  }
}

// Dummy scoring policies.
class OnePerMove implements IScoringPolicy<SourceState> {
  score(): Score {
    return Score.of(1);
  }
}

// The value of the cell that the move filled: the cell that `before` does not have.
class CellValue implements IScoringPolicy<SourceState> {
  score(before: SourceSnapshot, after: SourceSnapshot): Score {
    const placed = after
      .boardCopy()
      .occupiedCells()
      .find(([at]) => before.boardCopy().occupantAt(at) === undefined);
    return Score.of(placed?.[1].value ?? 0);
  }
}

// Dummy progress models. The fields of a result are private (issue #240),
// so a model asks the result for its record and gives the stars that it counts.
class ScoreProgress implements IProgressModel {
  record(result: GameResult, progress: GameProgress): void {
    progress.recordScore(result.recordWith());
  }
}

// A dummy level model that gives three stars to every result.
class ThreeStarsProgress implements IProgressModel {
  record(result: GameResult, progress: GameProgress): void {
    progress.recordLevel(result.recordWith(Stars.of(3)));
  }
}

// A subscriber of the engine events. On `GameOver` it builds a `GameResult`
// and records it in the progress of the game with the progress model.
// It counts the recorded results. The event delivers its data to the subscriber.
class ProgressSubscriber implements GameOverReceiver {
  readonly progress = GameProgress.start(GameId.of('fake-game'));
  recorded = 0;

  constructor(
    private readonly model: IProgressModel,
    private readonly moves: () => number,
  ) {}

  // Takes the events that the engine recorded. A test double may ask the class of an event.
  listen(events: readonly GameEvent[]): void {
    for (const event of events) if (event instanceof GameOver) event.deliverTo(this);
  }

  receive(gameId: GameId, _matchId: MatchId, _outcome: Outcome, finalScore: Score): void {
    const result = GameResult.of({ gameId, score: finalScore, moves: Moves.of(this.moves()) });
    this.model.record(result, this.progress);
    this.recorded += 1;
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
  const engine = new GameEngine(MATCH_ID, GameId.of('fake-game'), rules, scoring);
  engine.start(sourceState(source));
  let outcome: Outcome = Outcome.playing;
  for (const at of sourceState(source).board.coordinates()) {
    // The count includes this move, because the subscriber takes the events after the move.
    moves += 1;
    // A turn that throws is played once more.
    try {
      outcome = engine.play(at);
    } catch {
      outcome = engine.play(at);
    }
    subscriber.listen(engine.takeEvents());
  }
  return {
    outcome,
    state: engine.snapshot(),
    progress: subscriber.progress,
    recorded: subscriber.recorded,
  };
}

describe('swapping the piece source, the scoring policy and the progress model', () => {
  it('should_place_the_pieces_of_each_source_when_the_source_is_swapped', () => {
    const counting = playGame(sources.counting(), new OnePerMove(), new ScoreProgress());
    const constant = playGame(sources.constant(), new OnePerMove(), new ScoreProgress());

    expect(
      counting.state
        .boardCopy()
        .occupiedCells()
        .map(([, cell]) => cell.value),
    ).toEqual([1, 2, 3, 4]);
    expect(
      constant.state
        .boardCopy()
        .occupiedCells()
        .map(([, cell]) => cell.value),
    ).toEqual([9, 9, 9, 9]);
  });

  it('should_give_the_score_of_each_policy_when_the_scoring_is_swapped', () => {
    const perMove = playGame(sources.counting(), new OnePerMove(), new ScoreProgress());
    const byValue = playGame(sources.counting(), new CellValue(), new ScoreProgress());

    expect(perMove.state.scoreSoFar()).toEqual(Score.of(4));
    expect(byValue.state.scoreSoFar()).toEqual(Score.of(1 + 2 + 3 + 4));
  });

  it('should_give_the_record_of_each_model_when_the_progress_model_is_swapped', () => {
    const byScore = playGame(sources.constant(), new CellValue(), new ScoreProgress());
    const byStars = playGame(sources.constant(), new CellValue(), new ThreeStarsProgress());
    const gameId = GameId.of('fake-game');

    expect(byScore.recorded).toBe(1);
    expect(byScore.progress.keeps(ProgressRecord.of({ gameId, score: Score.of(36) }))).toBe(true);
    expect(byStars.recorded).toBe(1);
    // The record of a level keeps the moves of the play too (issue #156).
    expect(
      byStars.progress.keeps(
        ProgressRecord.of({ gameId, score: Score.of(36), stars: Stars.of(3), moves: Moves.of(4) }),
      ),
    ).toBe(true);
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

      expect(retried.state.boardCopy().occupiedCells()).toEqual(
        plain.state.boardCopy().occupiedCells(),
      );
      expect(retried.state.scoreSoFar()).toEqual(plain.state.scoreSoFar());
      expect(retried.recorded).toBe(1);
      expect(
        retried.progress.keeps(
          ProgressRecord.of({ gameId: GameId.of('fake-game'), score: Score.of(4) }),
        ),
      ).toBe(true);
    }
  });

  const combinations = [
    ['counting', 'one_per_move', 'score'],
    ['counting', 'cell_value', 'stars'],
    ['constant', 'one_per_move', 'stars'],
    ['constant', 'cell_value', 'score'],
  ] as const;
  for (const [source, scoring, progress] of combinations) {
    it(`should_end_the_game_when_the_board_fills_with_${source}_${scoring}_${progress}`, () => {
      const game = playGame(
        sources[source](),
        scorings[scoring](),
        progress === 'score' ? new ScoreProgress() : new ThreeStarsProgress(),
      );

      expect(game.outcome).toBe(Outcome.gameOver);
      expect(game.recorded).toBe(1);
    });
  }

  it('should_reject_a_fifth_move_and_keep_the_state_when_the_board_is_full', () => {
    const subscriber = new ProgressSubscriber(new ScoreProgress(), () => 4);
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new SourceRules(),
      new OnePerMove(),
    );
    engine.start(sourceState(sources.counting()));
    for (const at of sourceState(sources.counting()).board.coordinates()) engine.play(at);
    subscriber.listen(engine.takeEvents());
    const full = engine.snapshot();

    expect(() => engine.play(square(0, 0))).toThrow(RangeError);
    expect(() => engine.play(square(0, 0))).toThrow('game-over phase');
    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
    expect(engine.snapshot().boardCopy().occupiedCells()).toEqual(full.boardCopy().occupiedCells());
    expect(engine.snapshot().scoreSoFar()).toEqual(full.scoreSoFar());
    subscriber.listen(engine.takeEvents());
    expect(subscriber.recorded).toBe(1);
  });
});

describe('GameResult and ProgressRecord', () => {
  // A result and a record have no check of their own: each value object checks its value
  // (issues #203 and #204).
  const gameId = GameId.of('fake-game');
  const noMoves = Moves.of(0);

  it('should_throw_when_a_result_has_negative_moves', () => {
    expect(() => GameResult.of({ gameId, score: Score.of(0), moves: Moves.of(-1) })).toThrow(
      'move count',
    );
  });

  it('should_throw_when_a_result_has_a_negative_time', () => {
    const timed = (ms: number) =>
      GameResult.of({
        gameId,
        score: Score.of(0),
        moves: noMoves,
        elapsedMs: ElapsedTime.ofMs(ms),
      });

    expect(() => timed(-1)).toThrow('milliseconds');
    expect(timed(0).equals(timed(0))).toBe(true);
    expect(timed(0).equals(GameResult.of({ gameId, score: Score.of(0), moves: noMoves }))).toBe(
      false,
    );
  });

  it('should_throw_a_range_error_when_a_result_has_a_decimal_number_of_moves', () => {
    const played = () => GameResult.of({ gameId, score: Score.of(0), moves: Moves.of(2.5) });

    expect(played).toThrow(RangeError);
    expect(played).toThrow('move count');
  });

  it('should_throw_a_range_error_when_a_result_has_a_score_that_is_not_a_number', () => {
    const scored = () => GameResult.of({ gameId, score: Score.of(Number.NaN), moves: noMoves });

    expect(scored).toThrow(RangeError);
    expect(scored).toThrow('score');
  });

  it('should_throw_a_range_error_when_a_result_has_a_time_that_is_not_a_number', () => {
    const timed = () =>
      GameResult.of({
        gameId,
        score: Score.of(0),
        moves: noMoves,
        elapsedMs: ElapsedTime.ofMs(Number.NaN),
      });

    expect(timed).toThrow(RangeError);
    expect(timed).toThrow('milliseconds');
  });

  it('should_throw_a_range_error_when_a_result_has_an_infinite_score_or_time', () => {
    for (const score of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => GameResult.of({ gameId, score: Score.of(score), moves: noMoves })).toThrow(
        'score',
      );
    }
    expect(() =>
      GameResult.of({
        gameId,
        score: Score.of(0),
        moves: noMoves,
        elapsedMs: ElapsedTime.ofMs(Number.POSITIVE_INFINITY),
      }),
    ).toThrow('milliseconds');
  });

  it('should_throw_a_range_error_when_a_record_has_negative_stars', () => {
    const starred = (stars: number) =>
      ProgressRecord.of({ gameId, score: Score.of(0), stars: Stars.of(stars) });

    expect(() => starred(-1)).toThrow(RangeError);
    expect(() => starred(-1)).toThrow('star count');
    expect(starred(0).equals(starred(0))).toBe(true);
    expect(starred(0).equals(ProgressRecord.of({ gameId, score: Score.of(0) }))).toBe(false);
  });

  it('should_keep_the_optional_fields_when_a_result_has_a_level_and_a_time', () => {
    const result = GameResult.of({
      gameId: GameId.of('hexa-fit'),
      levelId: LevelId.of('fit-01'),
      score: Score.of(0),
      moves: Moves.of(12),
      elapsedMs: ElapsedTime.ofMs(3000),
    });

    const without = (change: { levelId?: LevelId; elapsedMs?: ElapsedTime }) =>
      GameResult.of({
        gameId: GameId.of('hexa-fit'),
        score: Score.of(0),
        moves: Moves.of(12),
        ...change,
      });

    expect(
      result.equals(without({ levelId: LevelId.of('fit-01'), elapsedMs: ElapsedTime.ofMs(3000) })),
    ).toBe(true);
    expect(result.equals(without({ elapsedMs: ElapsedTime.ofMs(3000) }))).toBe(false);
    expect(result.equals(without({ levelId: LevelId.of('fit-01') }))).toBe(false);
  });
});
