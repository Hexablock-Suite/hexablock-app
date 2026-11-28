/** @jest-environment node */
import type { GridAxis } from '../../../src/domain/engine/geometry/grid-topology';
import { Score } from '../../../src/domain/shared/score';
import { BoardId } from '../../../src/domain/engine/board/board-id';
import { ElapsedTime } from '../../../src/domain/shared/elapsed-time';
import type { BoardState, SnapshotOf } from '../../../src/domain/engine/board/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import { GameEngine } from '../../../src/domain/engine/turn/game-engine';
import { GameFactory } from '../../../src/domain/engine/factory/game-factory';
import { GameStateId } from '../../../src/domain/engine/board/game-state-id';
import { PlayingPhase } from '../../../src/domain/engine/turn/game-phase';
import { LevelTimer } from '../../../src/domain/engine/turn/level-timer';
import { MatchId } from '../../../src/domain/engine/match-id';
import type { MatchIdGenerator } from '../../../src/domain/engine/factory/match-id-generator';
import type { Resolution } from '../../../src/domain/engine/turn/resolution';
import type { IGameRules } from '../../../src/domain/engine/turn/rules';
import { Turns } from '../../../src/domain/engine/geometry/turns';
import type { IVariantFactory } from '../../../src/domain/engine/factory/variant-factory';
import { PlaceFitPiece } from '../../../src/domain/variants/hexa-fit/fit-move';
import type { FitState } from '../../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../../src/domain/variants/hexa-fit/piece-id';
import { Placement } from '../../../src/domain/variants/hexa-fit/placement';
import { PlacePiece } from '../../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../../src/domain/variants/hexa-lines/tray-position';
import { MergeTile } from '../../../src/domain/variants/hexa-merge/merge-tile';
import { SlideSense, Slide } from '../../../src/domain/variants/hexa-merge/slide';
import type { ColorStack } from '../../../src/domain/variants/hexa-sort/color-stack';
import { BOARD_ID, STATE_ID } from '../../support/engine/entity-ids';
import { gameIdOf, liveStateOf } from '../../support/engine/variant-game';
import { ManualClock } from '../../support/engine/manual-clock';
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
import { placeFrom, sortFactory, sortStateOf } from '../../support/variants/hexa-sort/sort-game';
import { viewData } from '../../support/variants/view-data';
import { playMove } from '../../support/engine/play-move';

// The regression probe of T18 (classes.md decisions 7 and 26). The verifier of the own ids
// wrote it. It pins four things at the public interface:
// - each game of one `GameFactory` gets its own state id and board id, and a clone keeps them;
// - the ids are local (issue #236, decision 52): the factory builds them from the `MatchId`,
//   so a match id generator that repeats an id gives two games with equal states;
// - an earlier snapshot, its cells, its score and its view never change after more moves;
// - a state method that throws, and rules that throw inside a turn, change nothing.
// Since R8 `GameEngine.snapshot()` gives a photo (decision 34). The photo holds the two ids
// and a copy of the board, so the probe asks each photo whose state it shows where it compared
// two states. The photo keeps its ids private (issue #245), so the probe names the state id
// that it expects. A view keeps its fields private too, so the probe compares the data that
// each view delivers. The rules and the state methods need a live state, so the probe builds one.

type AnyState<TCell, TCoord, TState> = BoardState<TCell, TCoord> & Cloneable<TState>;

const json = (value: unknown): string => JSON.stringify(value);

// The first two matches of a counting match id generator, and the ids of their states.
const FIRST_MATCH = MatchId.of('match-1');
const FIRST_STATE = GameStateId.of(FIRST_MATCH);
const SECOND_STATE = GameStateId.of(MatchId.of('match-2'));

// A game factory of the variant with a counting match id generator, unless a test gives its own.
function gamesOf<TCell, TCoord, TMove, TState extends AnyState<TCell, TCoord, TState>>(
  variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
  matchIds: MatchIdGenerator = new CountingMatchIds(),
): GameFactory<TCell, TCoord, TMove, TState> {
  return new GameFactory(gameIdOf(variant), variant, matchIds);
}

// The variant factory that gives each timer to `GameFactory` and keeps it in `timers`.
// The root hands out no timer (issue #234), so the probe compares the timers that the
// variant factory gave to each game, in the order of the games.
function recordingTimers<TCell, TCoord, TMove, TState extends AnyState<TCell, TCoord, TState>>(
  variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
) {
  const timers: LevelTimer[] = [];
  const recording: IVariantFactory<TCell, TCoord, TMove, TState, unknown> = {
    isFor: (gameId) => variant.isFor(gameId),
    createRules: () => variant.createRules(),
    createTimer: (matchId) => {
      const timer = variant.createTimer(matchId);
      if (timer !== undefined) timers.push(timer);
      return timer;
    },
    createScoring: () => variant.createScoring(),
    createPieceSource: () => variant.createPieceSource(),
    createBoard: (boardId) => variant.createBoard(boardId),
    createInitialState: (matchId, stateId, boardId) =>
      variant.createInitialState(matchId, stateId, boardId),
    createHistory: () => variant.createHistory(),
    createProgressModel: () => variant.createProgressModel(),
  };
  return { timers, recording };
}

// The timer that the variant factory gave to the game number `index`.
function timerAt(timers: readonly LevelTimer[], index: number): LevelTimer {
  const timer = timers[index];
  if (timer === undefined) throw new Error('The game has no level timer.');
  return timer;
}

// A copy of the state of a photo of the match `matchId`. A photo hands out no board (issue #234),
// so the probe builds the state of the photo again and asks that state for its copy.
function stateCopyOf<TCell, TCoord, TMove, TState extends AnyState<TCell, TCoord, TState>>(
  variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
  photo: SnapshotOf<TState>,
  matchId: MatchId,
): BoardState<TCell, TCoord> {
  const state = variant.createInitialState(matchId, GameStateId.of(matchId), BoardId.of(matchId));
  state.restore(photo);
  return state.clone();
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
    statesEqual: secondState.isPhotoOf(FIRST_STATE),
    boardsEqual: firstState.boardCopy().equals(secondState.boardCopy()),
    laterStateEqual: [firstState, first.snapshot()].every((photo) => photo.isPhotoOf(FIRST_STATE)),
    laterBoardEqual: firstState.boardCopy().equals(first.snapshot().boardCopy()),
    boardCloneEqual: stateCopyOf(variant, firstState, FIRST_MATCH)
      .snapshot()
      .boardCopy()
      .equals(firstState.boardCopy()),
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
    taken.push(
      json([
        snapshot.boardCopy().occupiedCells(),
        snapshot.scoreSoFar(),
        viewData(snapshot.view()),
      ]),
    );
    views.push(snapshot.view());
    viewsTaken.push(json(viewData(snapshot.view())));
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
  const now = snapshots.map((s) =>
    json([s.boardCopy().occupiedCells(), s.scoreSoFar(), viewData(s.view())]),
  );
  const viewsNow = views.map((view) => json(viewData(view)));
  const cellsBefore = json(game.snapshot().boardCopy().occupiedCells());
  const scoreBefore = game.snapshot().scoreSoFar();
  // The photo is frozen, so a write to it fails and changes neither the photo nor the game.
  const changed = game.snapshot();
  const writeRefused = !Reflect.set(changed, 'score', scoreBefore.add(Score.of(5)));
  return {
    taken,
    now,
    viewsTaken,
    viewsNow,
    cellsBefore,
    cellsAfter: json(game.snapshot().boardCopy().occupiedCells()),
    writeRefused,
    scoreBefore,
    gameScore: game.snapshot().scoreSoFar(),
    changedScore: changed.scoreSoFar(),
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
  return json([photo.boardCopy().occupiedCells(), photo.scoreSoFar(), viewData(photo.view())]);
}

function shownByFit(state: FitState<SquareCoord>): string {
  return json([
    shownBy(state),
    state.snapshot().moveCount(),
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

  validMoves(state: TState): Iterable<TMove> {
    return this.inner.validMoves(state);
  }

  playTurn(state: TState, move: TMove): Resolution {
    this.inner.playTurn(state, move);
    throw new Error('boom');
  }
}

// A game whose rules throw after the turn. It gives the error, the data and the phase.
function throwingTurnOf<TCell, TCoord, TMove, TState extends AnyState<TCell, TCoord, TState>>(
  variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
) {
  const game = new GameEngine<TCell, TCoord, TMove, TState>(
    MATCH_ID,
    gameIdOf(variant),
    new ThrowingAfterTurnRules(variant.createRules()),
    variant.createScoring(),
    variant.createHistory(),
  );
  game.start(variant.createInitialState(MATCH_ID, STATE_ID, BOARD_ID));
  const shown = () =>
    json([game.snapshot().boardCopy().occupiedCells(), game.snapshot().scoreSoFar()]);
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

  // Done when of issue #236: two matches share no state, no board and no timer.
  it('should_give_different_states_boards_and_timers_when_two_games_have_different_match_ids', () => {
    const { timers, recording } = recordingTimers(fitFactory());
    const games = gamesOf(recording);
    const first = games.createGame();
    const second = games.createGame();
    const timerOf = (game: typeof first) => timerAt(timers, game === first ? 0 : 1);

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect([
      first.snapshot().isPhotoOf(SECOND_STATE),
      second.snapshot().isPhotoOf(FIRST_STATE),
      first.snapshot().boardCopy().equals(second.snapshot().boardCopy()),
      second.snapshot().boardCopy().equals(first.snapshot().boardCopy()),
      timerOf(first).equals(timerOf(second)),
      timerOf(second).equals(timerOf(first)),
    ]).toEqual([false, false, false, false, false, false]);
    expect([
      first.snapshot().isPhotoOf(FIRST_STATE),
      first.snapshot().boardCopy().equals(first.snapshot().boardCopy()),
      timerOf(first).equals(timerOf(first)),
    ]).toEqual([true, true, true]);
  });

  // The `MatchIdGenerator` is the only source of global identity (decision 52).
  // `GameFactory` does not check it, so a generator that repeats an id gives two equal games,
  // and their internal entities are equal too.
  it('should_hold_equal_games_states_boards_and_timers_when_the_match_id_generator_repeats_an_id', () => {
    const { timers, recording } = recordingTimers(fitFactory());
    const games = gamesOf(recording, { next: () => MATCH_ID });
    const first = games.createGame();
    const second = games.createGame();

    expect([
      first.equals(second),
      first.snapshot().isPhotoOf(STATE_ID) && second.snapshot().isPhotoOf(STATE_ID),
      first.snapshot().boardCopy().equals(second.snapshot().boardCopy()),
      timerAt(timers, 0).equals(timerAt(timers, 1)),
    ]).toEqual([true, true, true, true]);
  });

  // The root reads the time of play from its own timer, so two games keep separate times.
  it('should_keep_separate_times_when_two_games_share_one_clock', () => {
    const clock = new ManualClock();
    const games = gamesOf(threeDominoFitFactory(clock));
    const first = games.createGame();
    const second = games.createGame();

    playMove(first, new PlaceFitPiece(A, Turns.of(0), square(0, 0)));
    clock.advance(1_000);

    expect([first.elapsedTime(), second.elapsedTime()]).toEqual([
      ElapsedTime.ofMs(1_000),
      ElapsedTime.ofMs(0),
    ]);
  });

  it('should_be_different_when_two_states_of_other_variants_have_the_same_id', () => {
    const sort = sortFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const merge = mergeFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);

    // The compiler refuses a state of another variant, so the cast reaches the runtime check.
    expect(sort.equals(merge as unknown as BoardState<ColorStack, SquareCoord>)).toBe(false);
  });

  it('should_stay_equal_when_a_move_changes_the_content_of_the_state', () => {
    const game = gamesOf(sortFactory()).createGame();
    const before = game.snapshot();
    const state = sortFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const earlier = state.clone();

    playMove(game, placeFrom(0, 0, 0));
    state.placeStack(placeFrom(0, 0, 0));

    expect([before, game.snapshot()].every((photo) => photo.isPhotoOf(FIRST_STATE))).toBe(true);
    expect(state.equals(earlier)).toBe(true);
  });
});

describe('aliasing of earlier snapshots (T18 probe)', () => {
  it('should_keep_every_earlier_snapshot_and_view_when_the_game_plays_more_moves', () => {
    const results = [
      aliasingOf(
        sortFactory(),
        [placeFrom(0, 0, 0), placeFrom(1, 1, 0), placeFrom(2, 0, 1)],
        (photo) => sortStateOf(photo, FIRST_MATCH),
      ),
      aliasingOf(
        linesFactory(),
        [
          new PlacePiece(TrayPosition.of(0), square(0, 0)),
          new PlacePiece(TrayPosition.of(0), square(1, 1)),
        ],
        (photo) => linesStateOf(photo, FIRST_MATCH),
      ),
      aliasingOf(
        threeDominoFitFactory(),
        [
          new PlaceFitPiece(A, Turns.of(0), square(0, 0)),
          new PlaceFitPiece(B, Turns.of(0), square(2, 0)),
        ],
        (photo) => fitStateOf(photo, threeDominoFitFactory().createPieceSource(), FIRST_MATCH),
      ),
      aliasingOf(mergeFactory(3), [], (photo) => mergeStateOf(photo, FIRST_MATCH)),
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
    const shown = () =>
      json([
        first.boardCopy().occupiedCells(),
        first.mergedTiles(),
        first.scoreSoFar(),
        first.hasReachedTarget(),
      ]);
    const before = shown();

    for (let i = 0; i < 6; i += 1) {
      const slide = firstOf(
        variant.createRules().validMoves(mergeStateOf(game.snapshot(), FIRST_MATCH)),
      );
      if (slide !== undefined) game.tryPlay(slide);
    }
    expect(shown()).toBe(before);

    // The photo freezes its list of merged tiles, so a push throws and changes nothing.
    expect(() => (first.mergedTiles() as MergeTile[]).push(MergeTile.of(2))).toThrow(TypeError);
    expect(first.mergedTiles()).toHaveLength(JSON.parse(before)[1].length);
  });
});

describe('atomicity of the state methods (T18 probe)', () => {
  it('should_keep_the_fit_state_when_a_fit_method_throws', () => {
    const state = threeDominoFitFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    // The board gives the full turn that a placement needs.
    const topology = state.snapshot().boardCopy();
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
      throwOf(shown, () => state.placeStack(placeFrom(0, 9, 9))),
      throwOf(shown, () => state.moveRun(square(0, 0), square(0, 1))),
      throwOf(shown, () => state.clearStack(square(0, 0))),
    ]);
    state.placeStack(placeFrom(0, 0, 0));
    const withOneStack = allKept([
      throwOf(shown, () => state.placeStack(placeFrom(1, 0, 0))),
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
      () => state.slide(Slide.of('zz' as unknown as GridAxis, SlideSense.forward)),
    );

    expect(result.rangeError).toBe(true);
    expect(result.after).toBe(result.before);
  });

  it('should_keep_the_lines_state_when_a_lines_method_throws', () => {
    const state = linesFactory().createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const shown = () => shownBy(state);

    const result = allKept([
      throwOf(shown, () => state.placePiece(new PlacePiece(TrayPosition.of(9), square(0, 0)))),
      throwOf(shown, () => state.placePiece(new PlacePiece(TrayPosition.of(0), square(9, 9)))),
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
