/** @jest-environment node */
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameId } from '../../../src/domain/engine/game-id';
import type { Outcome } from '../../../src/domain/engine/outcome';
import type { IPieceSource } from '../../../src/domain/engine/piece-source';
import {
  GameResult,
  ProgressRecord,
  type IProgressModel,
} from '../../../src/domain/engine/progress-model';
import { Resolution } from '../../../src/domain/engine/resolution';
import { BaseGameRules } from '../../../src/domain/engine/rules';
import type { IScoringPolicy } from '../../../src/domain/engine/scoring-policy';
import { fakeCell, type FakeCell } from '../../support/engine/fake-cell';
import { emptyState, RecordingPublisher, type FakeState } from '../../support/engine/fake-game';
import { type SquareCoord } from '../../support/engine/square-topology';

// APP-NFR-04: the piece source, the scoring policy and the progress model swap,
// and no engine file changes. Every implementation here is a dummy that exists only in test/.
// No real scoring: decision #59 (the scoring of each variant) is open.

// Dummy piece sources: both endless, each with its own sequence of cell values.
class CountingSource implements IPieceSource<FakeCell> {
  private value = 0;
  hasNext(): boolean {
    return true;
  }
  next(): FakeCell {
    this.value += 1;
    return fakeCell(this.value);
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
  *[Symbol.iterator](): Iterator<FakeCell> {
    while (this.hasNext()) yield this.next();
  }
}

// Dummy scoring policies.
class OnePerMove implements IScoringPolicy<FakeState> {
  score(): number {
    return 1;
  }
}

class CellValue implements IScoringPolicy<FakeState> {
  constructor(private readonly at: (resolution: Resolution<FakeState>) => FakeCell | undefined) {}
  score(_before: FakeState, resolution: Resolution<FakeState>): number {
    return this.at(resolution)?.value ?? 0;
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

// The rules put the next piece of their source on the chosen cell.
// The variant factory gives the rules their piece source (classes.md decision 31).
class SourceRules extends BaseGameRules<SquareCoord, FakeState> {
  last: SquareCoord | undefined;

  constructor(private readonly source: IPieceSource<FakeCell>) {
    super();
  }
  isValid(state: FakeState, at: SquareCoord): boolean {
    return state.board.contains(at) && state.board.get(at) === undefined;
  }
  *validMoves(state: FakeState): Iterable<SquareCoord> {
    for (const at of state.board.shape.cells) if (this.isValid(state, at)) yield at;
  }
  apply(state: FakeState, at: SquareCoord): FakeState {
    state.board.set(at, this.source.next());
    this.last = at;
    return state;
  }
  resolve(state: FakeState): Resolution<FakeState> {
    return Resolution.resolved(state);
  }
  evaluate(state: FakeState): Outcome {
    return this.noValidMove(state) ? 'game-over' : 'playing';
  }
}

const sources = {
  counting: () => new CountingSource(),
  constant: () => new ConstantSource(),
};

// One function plays every combination: the engine code is the same for all of them.
function playGame(
  source: IPieceSource<FakeCell>,
  scoringOf: (rules: SourceRules) => IScoringPolicy<FakeState>,
  progress: IProgressModel,
) {
  const rules = new SourceRules(source);
  const gameId = GameId.of('fake-game');
  const engine = new GameEngine(gameId, rules, scoringOf(rules), new RecordingPublisher());
  engine.start(emptyState(2));
  let moves = 0;
  let outcome: Outcome = 'playing';
  for (const at of emptyState(2).board.shape.cells) {
    outcome = engine.play(at);
    moves += 1;
  }
  const state = engine.snapshot();
  const result = GameResult.of({ gameId, score: state.score, moves });
  return { outcome, state, record: progress.record(result) };
}

const onePerMove = () => new OnePerMove();
const cellValue = (rules: SourceRules) =>
  new CellValue((resolution) =>
    rules.last === undefined ? undefined : resolution.state.board.get(rules.last),
  );

describe('swapping the piece source, the scoring policy and the progress model', () => {
  it('should_place_the_pieces_of_each_source_when_the_source_is_swapped', () => {
    const counting = playGame(sources.counting(), onePerMove, new ScoreProgress());
    const constant = playGame(sources.constant(), onePerMove, new ScoreProgress());

    expect(counting.state.board.cells().map(([, cell]) => cell.value)).toEqual([1, 2, 3, 4]);
    expect(constant.state.board.cells().map(([, cell]) => cell.value)).toEqual([9, 9, 9, 9]);
  });

  it('should_give_the_score_of_each_policy_when_the_scoring_is_swapped', () => {
    const perMove = playGame(sources.counting(), onePerMove, new ScoreProgress());
    const byValue = playGame(sources.counting(), cellValue, new ScoreProgress());

    expect(perMove.state.score).toBe(4);
    expect(byValue.state.score).toBe(1 + 2 + 3 + 4);
  });

  it('should_give_the_record_of_each_model_when_the_progress_model_is_swapped', () => {
    const byScore = playGame(sources.constant(), cellValue, new ScoreProgress());
    const byMoves = playGame(sources.constant(), cellValue, new MovesProgress());

    expect(byScore.record.score).toBe(36);
    expect(byMoves.record.score).toBe(4);
    expect(byMoves.record.gameId.value).toBe('fake-game');
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
        scoring === 'one_per_move' ? onePerMove : cellValue,
        progress === 'score' ? new ScoreProgress() : new MovesProgress(),
      );

      expect(game.outcome).toBe('game-over');
    });
  }
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
