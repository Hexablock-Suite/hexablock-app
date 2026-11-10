/** @jest-environment node */
import type { GridAxis } from '../../../src/domain/engine/grid-topology';
import { Score } from '../../../src/domain/engine/score';
import { BoardId } from '../../../src/domain/engine/board-id';
import type { BoardIdGenerator } from '../../../src/domain/engine/board-id-generator';
import type { BoardState, SnapshotOf } from '../../../src/domain/engine/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameFactory } from '../../../src/domain/engine/game-factory';
import { PlayingPhase } from '../../../src/domain/engine/game-phase';
import { GameStateId } from '../../../src/domain/engine/game-state-id';
import type { GameStateIdGenerator } from '../../../src/domain/engine/game-state-id-generator';
import type { Outcome } from '../../../src/domain/engine/outcome';
import type { Resolution } from '../../../src/domain/engine/resolution';
import type { IGameRules } from '../../../src/domain/engine/rules';
import type { ITimed } from '../../../src/domain/engine/timed';
import { Turns } from '../../../src/domain/engine/turns';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import { PlaceFitPiece } from '../../../src/domain/variants/hexa-fit/fit-move';
import type { FitState } from '../../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../../src/domain/variants/hexa-fit/piece-id';
import { Placement } from '../../../src/domain/variants/hexa-fit/placement';
import { PlacePiece } from '../../../src/domain/variants/hexa-lines/place-piece';
import { MergeTile } from '../../../src/domain/variants/hexa-merge/merge-tile';
import { SlideSense, Slide } from '../../../src/domain/variants/hexa-merge/slide';
import type { ColorStack } from '../../../src/domain/variants/hexa-sort/color-stack';
import {
  BOARD_ID,
  CountingBoardIds,
  CountingStateIds,
  STATE_ID,
} from '../../support/engine/entity-ids';
import { RecordingPublisher } from '../../support/engine/fake-game';
import { liveStateOf } from '../../support/engine/variant-game';
import { CountingMatchIds, MATCH_ID } from '../../support/engine/match-id';
import { square, type SquareCoord } from '../../support/engine/square-topology';
import {
  A,
  B,
  fitFactory,
  fitStateOf,
  threeDominoFitFactory,
} from '../../support/variants/hexa-fit/fit-game';
import { linesFactory, linesStateOf } from '../../support/variants/hexa-lines/lines-game';
import { mergeFactory, mergeStateOf } from '../../support/variants/hexa-merge/merge-game';
import { place, sortFactory, sortStateOf } from '../../support/variants/hexa-sort/sort-game';

// The regression probe of T18 (classes.md decisions 7 and 26). The verifier of the own ids
// wrote it. It pins four things at the public interface:
// - each game of one `GameFactory` gets its own state id and board id, and a clone keeps them;
// - a generator that repeats an id is not detected, so two games then hold equal states;
// - an earlier snapshot, its cells, its score and its view never change after more moves;
// - a state method that throws, and rules that throw inside a turn, change nothing.
// Since R8 `GameEngine.snapshot()` gives a photo (decision 34). The photo holds the two ids
// and a copy of the board, so the probe compares the ids of two photos where it compared
// two states. The rules and the state methods need a live state, so the probe builds one.

type AnyState<TCell, TCoord, TState> = BoardState<TCell, TCoord> & Cloneable<TState>;

const json = (value: unknown): string => JSON.stringify(value);

// A game factory of the variant with counting generators, unless a test gives its own.
function gamesOf<TCell, TCoord, TMove, TState extends AnyState<TCell, TCoord, TState>>(
  variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
  boardIds: BoardIdGenerator = new CountingBoardIds(),
  stateIds: GameStateIdGenerator = new CountingStateIds(),
): GameFactory<TCell, TCoord, TMove, TState> {
  return new GameFactory(
    variant,
    new CountingMatchIds(),
    stateIds,
    boardIds,
    new RecordingPublisher(),
  );
}

// The id facts of two games of one factory, in the order of `OWN_IDS`.
function idFactsOf<TCell, TCoord, TMove, TState extends AnyState<TCell, TCoord, TState>>(
  variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
): Record<string, boolean> {
  const games = gamesOf(variant);
  const first = games.createGame();
  const second = games.createGame();
  const firstState = first.snapshot();
  const secondState = second.snapshot();
  return {
    statesEqual: firstState.stateId.equals(secondState.stateId),
    boardsEqual: firstState.board.equals(secondState.board),
    laterStateEqual: firstState.stateId.equals(first.snapshot().stateId),
    laterBoardEqual: firstState.board.equals(first.snapshot().board),
    boardCloneEqual: firstState.board.clone().equals(firstState.board),
    gamesEqual: first.equals(second),
  };
}

const OWN_IDS = {
  statesEqual: false,
  boardsEqual: false,
  laterStateEqual: true,
  laterBoardEqual: true,
  boardCloneEqual: true,
  gamesEqual: false,
};

// What a game shows after it plays up to four moves. Each move comes from `fixed`,
// or else from the first valid move of the live state that `stateOf` builds from a photo.
// `taken` holds the data of each snapshot at that time,
// and `now` holds the data of the same snapshot after the last move.
// Then the probe tries to change a fresh photo and reads the game again.
function aliasingOf<TCell, TCoord, TMove, TState extends AnyState<TCell, TCoord, TState>>(
  variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
  fixed: readonly TMove[],
  stateOf: (photo: SnapshotOf<TState>) => TState,
) {
  const game = gamesOf(variant).createGame();
  const rules = variant.createRules();
  const snapshots: SnapshotOf<TState>[] = [];
  const views: unknown[] = [];
  const taken: string[] = [];
  const viewsTaken: string[] = [];
  const record = () => {
    const snapshot = game.snapshot();
    snapshots.push(snapshot);
    taken.push(json([snapshot.board.cells(), snapshot.score, snapshot.view()]));
    views.push(snapshot.view());
    viewsTaken.push(json(snapshot.view()));
  };
  record();
  for (let i = 0; i < 4; i += 1) {
    const move = fixed[i] ?? firstOf(rules.validMoves(stateOf(game.snapshot())));
    if (move === undefined) break;
    try {
      game.tryPlay(move);
    } catch {
      break;
    }
    record();
  }
  const now = snapshots.map((s) => json([s.board.cells(), s.score, s.view()]));
  const viewsNow = views.map((view) => json(view));
  const cellsBefore = json(game.snapshot().board.cells());
  const scoreBefore = game.snapshot().score;
  // The photo is frozen, so a write to it fails and changes neither the photo nor the game.
  const changed = game.snapshot();
  const writeRefused = !Reflect.set(changed, 'score', scoreBefore.add(Score.of(5)));
  return {
    taken,
    now,
    viewsTaken,
    viewsNow,
    cellsBefore,
    cellsAfter: json(game.snapshot().board.cells()),
    writeRefused,
    scoreBefore,
    gameScore: game.snapshot().score,
    changedScore: changed.score,
  };
}

function firstOf<T>(items: Iterable<T>): T | undefined {
  for (const item of items) return item;
  return undefined;
}

// The data that a state shows through its photo. A Fit state also shows its moves
// and the placed pieces with their placements.
function shownBy<TCell, TCoord>(state: BoardState<TCell, TCoord>): string {
  const photo = state.snapshot();
  return json([photo.board.cells(), photo.score, photo.view()]);
}

function shownByFit(state: FitState<SquareCoord>): string {
  return json([
    shownBy(state),
    state.snapshot().moves,
    state.placed().map((id) => [id, state.placementOf(id) !== undefined]),
  ]);
}

// Runs a call that must throw. It gives the thrown value and the data before and after.
function throwOf(shown: () => string, call: () => void) {
  const before = shown();
  let error: unknown;
  try {
    call();
  } catch (thrown) {
    error = thrown;
  }
  return { rangeError: error instanceof RangeError, before, after: shown() };
}

// Every call threw a RangeError and left the data as it was.
function allKept(results: readonly ReturnType<typeof throwOf>[]) {
  return {
    rangeErrors: results.map((r) => r.rangeError),
    after: results.map((r) => r.after),
    before: results.map((r) => r.before),
  };
}

// Rules that run the inner turn on the state they get and then throw,
// so the turn fails after the rules changed that state.
class ThrowingAfterTurnRules<TMove, TState> implements IGameRules<TMove, TState> {
  constructor(private readonly inner: IGameRules<TMove, TState>) {}

  isValid(state: TState, move: TMove): boolean {
    return this.inner.isValid(state, move);
  }

  validMoves(state: TState): Iterable<TMove> {
    return this.inner.validMoves(state);
  }

  apply(state: TState, move: TMove): TState {
    return this.inner.apply(state, move);
  }

  resolve(state: TState): Resolution {
    return this.inner.resolve(state);
  }

  evaluate(state: TState): Outcome {
    return this.inner.evaluate(state);
  }

  playTurn(state: TState, move: TMove): Resolution {
    this.inner.playTurn(state, move);
    throw new Error('boom');
  }

  timed(): ITimed | undefined {
    return this.inner.timed();
  }
}

// A game whose rules throw after the turn. It gives the error, the data and the phase.
function throwingTurnOf<TCell, TCoord, TMove, TState extends AnyState<TCell, TCoord, TState>>(
  variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
) {
  const game = new GameEngine<TCell, TCoord, TMove, TState>(
    MATCH_ID,
    variant.gameId,
    new ThrowingAfterTurnRules(variant.createRules()),
    variant.createScoring(),
    new RecordingPublisher(),
    variant.createHistory(),
  );
  game.start(variant.createInitialState(MATCH_ID, STATE_ID, BOARD_ID));
  const shown = () => json([game.snapshot().board.cells(), game.snapshot().score]);
  const before = shown();
  const move = firstOf(variant.createRules().validMoves(liveStateOf(variant, game.snapshot())));
  if (move === undefined) throw new Error('The first state has no valid move.');
  let message: unknown;
  try {
    game.tryPlay(move);
  } catch (thrown) {
    message = thrown instanceof Error ? thrown.message : thrown;
  }
  return {
    message,
    before,
    after: shown(),
    playing: game.currentPhase() === PlayingPhase.instance,
  };
}

describe('own ids of the board and the states (T18 probe)', () => {
  it('should_give_each_game_its_own_ids_when_one_factory_creates_two_games', () => {
    expect(idFactsOf(fitFactory())).toEqual(OWN_IDS);
    expect(idFactsOf(sortFactory())).toEqual(OWN_IDS);
    expect(idFactsOf(mergeFactory())).toEqual(OWN_IDS);
    expect(idFactsOf(linesFactory())).toEqual(OWN_IDS);
  });

  it('should_hold_equal_states_and_boards_when_a_generator_repeats_an_id', () => {
    const sameBoardId: BoardIdGenerator = { next: () => BoardId.of('x') };
    const sameStateId: GameStateIdGenerator = { next: () => GameStateId.of('x') };
    const games = gamesOf(sortFactory(), sameBoardId, sameStateId);
    const first = games.createGame();
    const second = games.createGame();

    expect(first.equals(second)).toBe(false);
    expect(first.snapshot().stateId.equals(second.snapshot().stateId)).toBe(true);
    expect(first.snapshot().board.equals(second.snapshot().board)).toBe(true);
  });

  it('should_be_different_when_two_states_of_other_variants_have_the_same_id', () => {
    const sort = sortFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const merge = mergeFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);

    // The compiler refuses a state of another variant, so the cast reaches the runtime check.
    expect(sort.equals(merge as unknown as BoardState<ColorStack, SquareCoord>)).toBe(false);
  });

  it('should_stay_equal_when_a_move_changes_the_content_of_the_state', () => {
    expect(() => BoardId.of('  ')).toThrow(RangeError);
    expect(() => GameStateId.of('')).toThrow(RangeError);
    const game = gamesOf(sortFactory()).createGame();
    const before = game.snapshot();
    const state = sortFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const earlier = state.clone();

    game.play(place(0, 0));
    state.placeOfferedStack(square(0, 0));

    expect(game.snapshot().stateId.equals(before.stateId)).toBe(true);
    expect(state.equals(earlier)).toBe(true);
  });
});

describe('aliasing of earlier snapshots (T18 probe)', () => {
  it('should_keep_every_earlier_snapshot_and_view_when_the_game_plays_more_moves', () => {
    const results = [
      aliasingOf(sortFactory(), [place(0, 0), place(1, 0), place(0, 1)], sortStateOf),
      aliasingOf(
        linesFactory(),
        [new PlacePiece(0, square(0, 0)), new PlacePiece(0, square(1, 1))],
        linesStateOf,
      ),
      aliasingOf(
        threeDominoFitFactory(),
        [
          new PlaceFitPiece(A, Turns.of(0), square(0, 0)),
          new PlaceFitPiece(B, Turns.of(0), square(2, 0)),
        ],
        (photo) => fitStateOf(photo, threeDominoFitFactory().createPieceSource()),
      ),
      aliasingOf(mergeFactory(3), [], mergeStateOf),
    ];

    for (const result of results) {
      expect(result.now).toEqual(result.taken);
      expect(result.viewsNow).toEqual(result.viewsTaken);
      expect(result.cellsAfter).toBe(result.cellsBefore);
      expect(result.writeRefused).toBe(true);
      expect([result.gameScore, result.changedScore]).toEqual([
        result.scoreBefore,
        result.scoreBefore,
      ]);
    }
  });

  it('should_keep_the_merged_tiles_the_source_and_the_board_when_the_merge_game_moves_on', () => {
    const variant = mergeFactory(3);
    const game = gamesOf(variant).createGame();
    const first = game.snapshot();
    const shown = () => json([first.board.cells(), first.merged, first.score, first.targetReached]);
    const before = shown();

    for (let i = 0; i < 6; i += 1) {
      const slide = firstOf(variant.createRules().validMoves(mergeStateOf(game.snapshot())));
      if (slide !== undefined) game.tryPlay(slide);
    }
    expect(shown()).toBe(before);

    // The photo freezes its list of merged tiles, so a push throws and changes nothing.
    expect(() => (first.merged as MergeTile[]).push(MergeTile.of(2))).toThrow(TypeError);
    expect(first.merged).toHaveLength(JSON.parse(before)[1].length);
  });
});

describe('atomicity of the state methods (T18 probe)', () => {
  it('should_keep_the_fit_state_when_a_fit_method_throws', () => {
    const state = threeDominoFitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { topology } = state.snapshot().board;
    const shown = () => shownByFit(state);

    const result = allKept([
      // The second cell of the domino lies outside the figure.
      throwOf(shown, () => state.place(A, Placement.of(Turns.of(0), square(5, 0), topology))),
      throwOf(shown, () =>
        state.place(PieceId.of('nope'), Placement.of(Turns.of(0), square(0, 0), topology)),
      ),
      throwOf(shown, () => state.addPoints(Score.of(Number.NaN))),
    ]);

    expect(result.rangeErrors).toEqual([true, true, true]);
    expect(result.after).toEqual(result.before);
  });

  it('should_keep_the_sort_state_when_a_sort_method_throws', () => {
    const state = sortFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const shown = () => shownBy(state);

    const onFreeBoard = allKept([
      throwOf(shown, () => state.placeOfferedStack(square(9, 9))),
      throwOf(shown, () => state.moveRun(square(0, 0), square(0, 1))),
      throwOf(shown, () => state.clearStack(square(0, 0))),
    ]);
    state.placeOfferedStack(square(0, 0));
    const withOneStack = allKept([
      throwOf(shown, () => state.placeOfferedStack(square(0, 0))),
      throwOf(shown, () => state.moveRun(square(0, 0), square(9, 9))),
      throwOf(shown, () => state.moveRun(square(0, 0), square(0, 0))),
    ]);

    expect(onFreeBoard.rangeErrors).toEqual([true, true, true]);
    expect(onFreeBoard.after).toEqual(onFreeBoard.before);
    expect(withOneStack.rangeErrors).toEqual([true, true, true]);
    expect(withOneStack.after).toEqual(withOneStack.before);
  });

  it('should_keep_the_merge_state_when_a_slide_names_an_unknown_axis', () => {
    const state = mergeFactory(1).createInitialState(MATCH_ID, STATE_ID, BOARD_ID);

    const result = throwOf(
      () => shownBy(state),
      () => state.slide(Slide.of('zz' as unknown as GridAxis, SlideSense.forward), MergeTile.of(8)),
    );

    expect(result.rangeError).toBe(true);
    expect(result.after).toBe(result.before);
  });

  it('should_keep_the_lines_state_when_a_lines_method_throws', () => {
    const state = linesFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const shown = () => shownBy(state);

    const result = allKept([
      throwOf(shown, () => state.placePiece(new PlacePiece(9, square(0, 0)))),
      throwOf(shown, () => state.placePiece(new PlacePiece(0, square(9, 9)))),
      throwOf(shown, () => state.clearLines([[square(0, 0)]])),
    ]);

    expect(result.rangeErrors).toEqual([true, true, true]);
    expect(result.after).toEqual(result.before);
  });

  it('should_keep_the_game_when_the_rules_throw_after_they_changed_their_copy', () => {
    for (const result of [throwingTurnOf(sortFactory()), throwingTurnOf(linesFactory())]) {
      expect(result.message).toBe('boom');
      expect(result.after).toBe(result.before);
      expect(result.playing).toBe(true);
    }
  });
});
