/** @jest-environment node */
import { BoardId } from '../../src/domain/engine/board-id';
import type { BoardSnapshot, BoardState } from '../../src/domain/engine/board-state';
import type { Cloneable } from '../../src/domain/engine/cloneable';
import { ElapsedTime } from '../../src/domain/engine/elapsed-time';
import { GameStateId } from '../../src/domain/engine/game-state-id';
import { MatchId } from '../../src/domain/engine/match-id';
import { Outcome } from '../../src/domain/engine/outcome';
import { Score } from '../../src/domain/engine/score';
import { Turns } from '../../src/domain/engine/turns';
import type { IVariantFactory } from '../../src/domain/engine/variant-factory';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import type { FitView } from '../../src/domain/variants/hexa-fit/fit-state';
import type { MoveResult } from '../../src/application/move-result';
import type { Result } from '../../src/application/result';
import { gameUseCases, valueOf } from '../support/application/game-use-cases';
import { ManualClock } from '../support/engine/manual-clock';
import { square } from '../support/engine/square-topology';
import { firstMoveOf, firstValidMove } from '../support/engine/variant-game';
import { A, B, C, fitFactory, threeDominoFitFactory } from '../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../support/variants/hexa-lines/lines-game';
import { mergeFactory, mergeStateOf } from '../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../support/variants/hexa-sort/sort-game';
import { fitViewData } from '../support/variants/view-data';

// R7: the state of a game and its board are entities (classes.md decisions 7 and 26).
// The state has its own `GameStateId` and knows its match. The board has its own `BoardId`.
// A move, an undo and a Merge slide change the state, and never its identity.
// The use cases open the first game with the match id `match-1`. The ids of its state
// and of its board are local: `GameFactory` builds them from that match id (issue #236).

const MATCH = MatchId.of('match-1');
const STATE = GameStateId.of(MATCH);
const BOARD = BoardId.of(MATCH);

// Another match, whose state and board hold the ids of that match.
const OTHER = MatchId.of('match-2');

// The identity of the running state: its match, its own id and the id of its board.
// The engine gives only a photo, and the photo holds the two ids and a copy of the board.
// The photo keeps its ids private (issue #245), so the test asks it whether it shows
// the state of the match `MATCH` or of the match `OTHER`.
function identityOf<TCell, TCoord>(
  photo: BoardSnapshot<TCell, TCoord>,
  reference: BoardState<TCell, TCoord>,
  other: BoardState<TCell, TCoord>,
) {
  return {
    ofTheMatch: photo.belongsTo(MATCH),
    ofAnotherMatch: photo.belongsTo(OTHER),
    sameState: photo.isPhotoOf(STATE),
    anotherState: photo.isPhotoOf(GameStateId.of(OTHER)),
    sameBoard: photo.boardCopy().equals(reference.snapshot().boardCopy()),
    anotherBoard: photo.boardCopy().equals(other.snapshot().boardCopy()),
  };
}

const KEPT = {
  ofTheMatch: true,
  ofAnotherMatch: false,
  sameState: true,
  anotherState: false,
  sameBoard: true,
  anotherBoard: false,
};

// Starts a game, plays one valid move, and undoes it when the variant has undo.
// It returns the identity of the running state after each step.
async function playAndUndo<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { games, startGame, applyMove, undoMove } = gameUseCases(factory);
  const reference = factory.createInitialState(MATCH, STATE, BOARD);
  const other = factory.createInitialState(OTHER, GameStateId.of(OTHER), BoardId.of(OTHER));
  const identity = () => identityOf(games.running().snapshot(), reference, other);
  valueOf(await startGame.execute({}));
  const started = identity();
  const move = firstMoveOf(factory);
  valueOf(await applyMove.execute({ move }));
  const moved = identity();
  const undone = factory.createHistory() === undefined ? undefined : await undoMove.execute({});
  return { started, moved, undone: undone === undefined ? undefined : identity() };
}

describe('The identity of the running state', () => {
  it('should_keep_the_state_of_its_match_and_its_board_when_a_move_is_applied_and_undone', async () => {
    const runs = {
      lines: await playAndUndo(linesFactory()),
      fit: await playAndUndo(fitFactory()),
      sort: await playAndUndo(sortFactory()),
      merge: await playAndUndo(mergeFactory()),
    };

    expect(runs).toEqual({
      lines: { started: KEPT, moved: KEPT, undone: undefined },
      fit: { started: KEPT, moved: KEPT, undone: KEPT },
      sort: { started: KEPT, moved: KEPT, undone: undefined },
      merge: { started: KEPT, moved: KEPT, undone: KEPT },
    });
  });

  it('should_keep_the_identity_of_the_merge_state_when_each_slide_is_applied', async () => {
    const factory = mergeFactory(7);
    const { games, startGame, applyMove } = gameUseCases(factory);
    const reference = factory.createInitialState(MATCH, STATE, BOARD);
    const other = factory.createInitialState(OTHER, GameStateId.of(OTHER), BoardId.of(OTHER));
    valueOf(await startGame.execute({}));
    const seen = [];

    for (let turn = 0; turn < 5; turn += 1) {
      const move = firstValidMove(
        factory.createRules(),
        mergeStateOf(games.running().snapshot(), MATCH),
      );
      valueOf(await applyMove.execute({ move }));
      seen.push(identityOf(games.running().snapshot(), reference, other));
    }

    expect(seen).toEqual([KEPT, KEPT, KEPT, KEPT, KEPT]);
  });

  it('should_throw_a_range_error_and_keep_the_game_when_a_state_of_another_match_starts_it', async () => {
    const factory = linesFactory();
    const { games, startGame } = gameUseCases(factory);
    valueOf(await startGame.execute({}));
    const engine = games.running();
    const before = engine.snapshot().boardCopy().occupiedCells();
    const foreign = factory.createInitialState(OTHER, STATE, BOARD);

    expect(() => engine.start(foreign)).toThrow(
      new RangeError('The first state belongs to another match.'),
    );
    expect(engine.snapshot().boardCopy().occupiedCells()).toEqual(before);
    expect(engine.snapshot().belongsTo(MATCH)).toBe(true);
  });
});

// Done when of issue #236: the local ids change no answer of a Fit game.
// The expected answers are the answers of the code before #236, written out as values.
describe('A Fit game through the use cases', () => {
  // The part of a move result that a screen reads, with the ids of the pieces of the payload.
  // The Fit view keeps its fields private, so the test reads the data that it delivers (#245).
  function answerOf(result: Result<MoveResult<unknown, unknown, unknown>>) {
    const value = valueOf(result);
    const payload = fitViewData(value.payload as FitView<unknown>);
    return {
      cells: value.cells,
      score: value.score,
      outcome: value.outcome,
      canUndo: value.canUndo,
      canRedo: value.canRedo,
      remaining: payload.remaining.map((piece) => piece.occupant()),
      placed: payload.placed,
      elapsedMs: value.elapsedMs,
    };
  }

  it('should_give_the_same_answers_as_before_when_a_fit_game_starts_plays_and_undoes', async () => {
    const clock = new ManualClock();
    const { startGame, applyMove, undoMove } = gameUseCases(threeDominoFitFactory(clock));
    const place = (piece: typeof A, col: number) =>
      new PlaceFitPiece(piece, Turns.of(0), square(col, 0));

    const started = answerOf(await startGame.execute({}));
    clock.advance(1_000);
    const first = answerOf(await applyMove.execute({ move: place(A, 0) }));
    clock.advance(2_000);
    const second = answerOf(await applyMove.execute({ move: place(B, 2) }));
    clock.advance(3_000);
    const undone = answerOf(await undoMove.execute({}));
    clock.advance(4_000);
    const again = answerOf(await applyMove.execute({ move: place(B, 2) }));
    const last = answerOf(await applyMove.execute({ move: place(C, 4) }));

    const cellsOf = (...pieces: (typeof A)[]) =>
      pieces.flatMap((piece, i) => [
        [square(2 * i, 0), piece],
        [square(2 * i + 1, 0), piece],
      ]);
    const playing = { score: Score.of(0), outcome: Outcome.playing, canRedo: false };
    expect([started, first, second, undone, again, last]).toEqual([
      {
        ...playing,
        cells: [],
        canUndo: false,
        remaining: [A, B, C],
        placed: [],
        elapsedMs: ElapsedTime.ofMs(0),
      },
      {
        ...playing,
        cells: cellsOf(A),
        canUndo: true,
        remaining: [B, C],
        placed: [A],
        elapsedMs: ElapsedTime.ofMs(0),
      },
      {
        ...playing,
        cells: cellsOf(A, B),
        canUndo: true,
        remaining: [C],
        placed: [A, B],
        elapsedMs: ElapsedTime.ofMs(2_000),
      },
      // Since #178 Fit redoes, so the undone move can be played again.
      {
        ...playing,
        cells: cellsOf(A),
        canUndo: true,
        canRedo: true,
        remaining: [B, C],
        placed: [A],
        elapsedMs: ElapsedTime.ofMs(5_000),
      },
      {
        ...playing,
        cells: cellsOf(A, B),
        canUndo: true,
        remaining: [C],
        placed: [A, B],
        elapsedMs: ElapsedTime.ofMs(9_000),
      },
      {
        ...playing,
        outcome: Outcome.victory,
        cells: cellsOf(A, B, C),
        canUndo: false,
        remaining: [],
        placed: [A, B, C],
        elapsedMs: ElapsedTime.ofMs(9_000),
      },
    ]);
  });
});
