/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/outcome';
import { Moves } from '../../../src/domain/shared/moves';
import { Score } from '../../../src/domain/shared/score';
import type { Board } from '../../../src/domain/engine/board';
import { BoardId } from '../../../src/domain/engine/board-id';
import { GameId } from '../../../src/domain/shared/game-id';
import { GameStateId } from '../../../src/domain/engine/game-state-id';
import { MatchId } from '../../../src/domain/engine/match-id';
import { hex, HexAxis, type HexCoord } from '../../../src/domain/engine/hex-topology';
import { Resolution } from '../../../src/domain/engine/resolution';
import { Turns } from '../../../src/domain/engine/turns';
import { FitScoring } from '../../../src/domain/variants/hexa-fit/fit-scoring';
import { Placement } from '../../../src/domain/variants/hexa-fit/placement';
import { CellCount } from '../../../src/domain/variants/hexa-lines/cell-count';
import { LineCount } from '../../../src/domain/variants/hexa-lines/line-count';
import { LinesScoring } from '../../../src/domain/variants/hexa-lines/lines-scoring';
import { PlacePiece } from '../../../src/domain/variants/hexa-lines/place-piece';
import { Streak } from '../../../src/domain/variants/hexa-lines/streak';
import { TrayPosition } from '../../../src/domain/variants/hexa-lines/tray-position';
import { MergeScoring } from '../../../src/domain/variants/hexa-merge/merge-scoring';
import { MergeTile } from '../../../src/domain/variants/hexa-merge/merge-tile';
import { SlideSense, Slide } from '../../../src/domain/variants/hexa-merge/slide';
import { ClearedStacks } from '../../../src/domain/variants/hexa-sort/cleared-stacks';
import { SortScoring } from '../../../src/domain/variants/hexa-sort/sort-scoring';
import { BOARD_ID } from '../../support/engine/entity-ids';
import { CountingMatchIds, MATCH_ID } from '../../support/engine/match-id';
import { square } from '../../support/engine/square-topology';
import { A, fitFactory } from '../../support/variants/hexa-fit/fit-game';
import { linesFactory, red } from '../../support/variants/hexa-lines/lines-game';
import { mergeFactory, mergeState, valueOf } from '../../support/variants/hexa-merge/merge-game';
import {
  row,
  sortFactory,
  sortState,
  stack,
  tiles,
} from '../../support/variants/hexa-sort/sort-game';
import { GameFactory } from '../../../src/domain/engine/game-factory';
import {
  fitViewData,
  linesViewData,
  mergeViewData,
  sortViewData,
} from '../../support/variants/view-data';

// R8, step 2 of the game state (classes.md decisions 7, 26, 29 and 34).
// Each state gives one immutable photo of itself with `snapshot()`, and it takes that photo back
// with `restore()`. The photo is the Memento of the undo, the screen data of `view()` and the
// answer of `GameEngine.snapshot()`. It carries domain values and no behavior of the state.

const json = (value: unknown): string => JSON.stringify(value);
const OTHER_STATE = GameStateId.of(MatchId.of('another-match'));

describe('the photo of a state', () => {
  it('should_hold_the_lines_data_in_a_frozen_photo_when_a_lines_state_takes_its_snapshot', () => {
    const state = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    state.placePiece(new PlacePiece(TrayPosition.of(0), square(0, 0)));

    const photo = state.snapshot();

    expect(Object.isFrozen(photo)).toBe(true);
    expect(Object.isFrozen(photo.trayPieces())).toBe(true);
    expect([photo.isPhotoOf(OTHER_STATE), photo.belongsTo(MATCH_ID)]).toEqual([true, true]);
    expect(
      json([photo.boardCopy().occupiedCells(), photo.scoreSoFar(), photo.trayPieces().length]),
    ).toBe(json([[[square(0, 0), red]], Score.of(0), 2]));
    expect([photo.currentStreak(), photo.lastCombo(), photo.lastPlacedCells()]).toEqual([
      Streak.of(0),
      LineCount.of(0),
      CellCount.of(1),
    ]);
    expect(json(linesViewData(photo.view()))).toBe(json({ tray: photo.trayPieces() }));
  });

  it('should_hold_the_sort_data_in_a_frozen_photo_when_a_sort_state_takes_its_snapshot', () => {
    const state = sortState({ board: row(2), offered: [stack('red'), stack('blue')] });
    state.placeOfferedStack(square(1, 0));

    const photo = state.snapshot();

    expect(Object.isFrozen(photo)).toBe(true);
    expect(Object.isFrozen(photo.clearedStackHeights())).toBe(true);
    expect(
      json([
        photo.offeredStack(),
        photo.goalsReached(),
        photo.clearedStackHeights(),
        photo.lastPlacedAt(),
      ]),
    ).toBe(json([state.snapshot().offeredStack(), ClearedStacks.of(0), [], square(1, 0)]));
    expect(photo.goalsReached()).toBeInstanceOf(ClearedStacks);
    expect(photo.goal().isReachedBy(ClearedStacks.of(5))).toBe(true);
    expect(json(sortViewData(photo.view()))).toBe(
      json({
        offered: photo.offeredStack(),
        goalsDone: ClearedStacks.of(0),
        goalsNeeded: photo.goal(),
      }),
    );
  });

  it('should_hold_the_merge_data_in_a_frozen_photo_when_a_merge_state_takes_its_snapshot', () => {
    const state = mergeState([
      [hex(0, 0), 2],
      [hex(1, 0), 2],
    ]);
    const slide = Slide.of(HexAxis.q, SlideSense.forward);
    state.slide(slide, MergeTile.of(4));

    const photo = state.snapshot();

    expect(Object.isFrozen(photo)).toBe(true);
    expect(Object.isFrozen(photo.mergedTiles())).toBe(true);
    expect([photo.hasReachedTarget(), photo.mergedTiles().map(valueOf)]).toEqual([true, [4]]);
    expect(json(mergeViewData(photo.view()))).toBe(json({ targetReached: true }));
  });

  it('should_hold_the_fit_data_in_a_frozen_photo_when_a_fit_state_takes_its_snapshot', () => {
    const state = fitFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const placement = Placement.of(Turns.of(0), square(0, 0), state.snapshot().boardCopy());
    state.place(A, placement);
    state.countMove();

    const photo = state.snapshot();

    expect(Object.isFrozen(photo)).toBe(true);
    expect(Object.isFrozen(photo.piecePlacements())).toBe(true);
    expect(photo.moveCount()).toBeInstanceOf(Moves);
    expect(photo.moveCount().equals(Moves.of(1))).toBe(true);
    expect(
      photo
        .piecePlacements()
        .map(([id, at]) => [id.equals(A), at.equals(placement, photo.boardCopy())]),
    ).toEqual([[true, true]]);
    expect(json(fitViewData(photo.view()))).toBe(
      json({ remaining: [], placed: [A], moves: Moves.of(1) }),
    );
  });

  it('should_keep_the_photo_and_the_state_apart_when_either_one_changes', () => {
    const state = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    const before = json([
      photo.boardCopy().occupiedCells(),
      photo.trayPieces(),
      photo.scoreSoFar(),
    ]);

    state.placePiece(new PlacePiece(TrayPosition.of(0), square(0, 0)));
    state.addPoints(Score.of(7));
    expect(json([photo.boardCopy().occupiedCells(), photo.trayPieces(), photo.scoreSoFar()])).toBe(
      before,
    );

    const later = state.snapshot();
    const shown = json(later.boardCopy().occupiedCells());
    (later.boardCopy() as Board<typeof red, ReturnType<typeof square>>).occupy(square(2, 2), red);
    expect(json(state.snapshot().boardCopy().occupiedCells())).toBe(shown);
  });
});

describe('the restore of a state from its photo', () => {
  it('should_give_back_the_board_the_score_the_tray_and_the_next_piece_when_lines_restores', () => {
    const state = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    // The third piece empties the tray, so the source draws three new pieces.
    for (const col of [0, 1, 2])
      state.placePiece(new PlacePiece(TrayPosition.of(0), square(col, 0)));
    state.clearLines([[square(0, 0), square(1, 0), square(2, 0)]]);
    state.addPoints(Score.of(13));

    state.restore(photo);

    const back = state.snapshot();
    expect(
      json([
        back.boardCopy().occupiedCells(),
        back.scoreSoFar(),
        back.trayPieces(),
        back.currentStreak(),
      ]),
    ).toBe(
      json([
        photo.boardCopy().occupiedCells(),
        photo.scoreSoFar(),
        photo.trayPieces(),
        photo.currentStreak(),
      ]),
    );
    expect([back.lastCombo(), back.lastPlacedCells()]).toEqual([
      photo.lastCombo(),
      photo.lastPlacedCells(),
    ]);
    expect(json(back.pieceSource().take()[0])).toBe(json(photo.pieceSource().take()[0]));
  });

  it('should_give_back_the_offered_stack_and_the_source_when_sort_restores', () => {
    const state = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    state.placeOfferedStack(square(0, 0));
    state.addPoints(Score.of(4));

    state.restore(photo);

    const back = state.snapshot();
    expect(
      json([
        back.boardCopy().occupiedCells(),
        back.scoreSoFar(),
        back.offeredStack(),
        back.goalsReached(),
      ]),
    ).toBe(
      json([
        photo.boardCopy().occupiedCells(),
        photo.scoreSoFar(),
        photo.offeredStack(),
        photo.goalsReached(),
      ]),
    );
    expect(json([back.clearedStackHeights(), back.lastPlacedAt()])).toBe(
      json([photo.clearedStackHeights(), photo.lastPlacedAt()]),
    );
    expect(json(back.pieceSource().take()[0])).toBe(json(photo.pieceSource().take()[0]));
  });

  it('should_give_back_the_tiles_and_the_tile_source_when_merge_restores', () => {
    const state = mergeFactory(5).createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    state.addNewTile();
    state.addNewTile();
    state.addPoints(Score.of(8));

    state.restore(photo);

    const back = state.snapshot();
    expect(
      json([
        back.boardCopy().occupiedCells(),
        back.scoreSoFar(),
        back.hasReachedTarget(),
        back.mergedTiles(),
      ]),
    ).toBe(
      json([
        photo.boardCopy().occupiedCells(),
        photo.scoreSoFar(),
        photo.hasReachedTarget(),
        photo.mergedTiles(),
      ]),
    );
    expect(json(back.tileSource().take()[0])).toBe(json(photo.tileSource().take()[0]));
  });

  // Issue 215: a piece source is a value. A draw replaces the source of the state,
  // and `restore()` takes back the source of the photo itself, with no copy.
  // Each test compares two sources with `===`: a failed `toBe` would print an endless source.
  it('should_draw_the_same_tray_again_when_lines_draws_and_then_restores_its_photo', () => {
    const state = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    const refill = (): string => {
      for (const col of [0, 1, 2])
        state.placePiece(new PlacePiece(TrayPosition.of(0), square(col, 0)));
      return json(state.snapshot().trayPieces());
    };
    const first = refill();
    expect(state.snapshot().pieceSource() === photo.pieceSource()).toBe(false);

    state.restore(photo);

    expect(state.snapshot().pieceSource() === photo.pieceSource()).toBe(true);
    expect(refill()).toBe(first);
  });

  it('should_offer_the_same_stack_again_when_sort_draws_and_then_restores_its_photo', () => {
    const state = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    state.placeOfferedStack(square(0, 0));
    const first = json(state.snapshot().offeredStack());
    expect(first).not.toBe(json(photo.offeredStack()));

    state.restore(photo);

    expect(state.snapshot().pieceSource() === photo.pieceSource()).toBe(true);
    state.placeOfferedStack(square(0, 0));
    expect(json(state.snapshot().offeredStack())).toBe(first);
  });

  it('should_add_the_same_tile_again_when_merge_draws_and_then_restores_its_photo', () => {
    const state = mergeFactory(5).createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    state.addNewTile();
    const first = json(state.snapshot().boardCopy().occupiedCells());
    expect(first).not.toBe(json(photo.boardCopy().occupiedCells()));

    state.restore(photo);

    expect(state.snapshot().tileSource() === photo.tileSource()).toBe(true);
    state.addNewTile();
    expect(json(state.snapshot().boardCopy().occupiedCells())).toBe(first);
  });

  it('should_keep_the_next_tile_of_the_state_when_a_reader_draws_from_the_source_of_a_photo', () => {
    const state = mergeFactory(5).createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const twin = mergeFactory(5).createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();

    const drawn = [photo.tileSource().take()[0], photo.tileSource().take()[1].take()[0]];

    expect(json(drawn[0])).toBe(json(state.snapshot().tileSource().take()[0]));
    state.addNewTile();
    twin.addNewTile();
    expect(json(state.snapshot().boardCopy().occupiedCells())).toBe(
      json(twin.snapshot().boardCopy().occupiedCells()),
    );
  });

  it('should_give_back_the_placements_and_the_moves_when_fit_restores', () => {
    const state = fitFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    state.place(A, Placement.of(Turns.of(0), square(0, 0), photo.boardCopy()));
    state.countMove();

    state.restore(photo);

    const back = state.snapshot();
    expect(
      json([
        back.boardCopy().occupiedCells(),
        back.scoreSoFar(),
        back.moveCount(),
        fitViewData(back.view()),
      ]),
    ).toBe(
      json([
        photo.boardCopy().occupiedCells(),
        photo.scoreSoFar(),
        photo.moveCount(),
        fitViewData(photo.view()),
      ]),
    );
    expect(back.piecePlacements()).toEqual([]);
    expect(state.placementOf(A)).toBeUndefined();
  });

  it('should_throw_and_keep_the_state_when_the_photo_belongs_to_another_state', () => {
    const state = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const stranger = sortFactory()
      .createInitialState(MATCH_ID, GameStateId.of(MatchId.of('stranger')), BOARD_ID)
      .snapshot();
    state.placeOfferedStack(square(0, 0));
    const before = json(state.snapshot().boardCopy().occupiedCells());

    expect(() => state.restore(stranger)).toThrow(
      new RangeError('The snapshot belongs to another state.'),
    );
    expect(json(state.snapshot().boardCopy().occupiedCells())).toBe(before);
  });

  it('should_throw_and_keep_the_board_when_the_photo_holds_another_board', () => {
    const state = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const other = sortFactory()
      .createInitialState(MATCH_ID, OTHER_STATE, BoardId.of(MatchId.of('another-match')))
      .snapshot();
    state.placeOfferedStack(square(0, 0));
    const before = json(state.snapshot().boardCopy().occupiedCells());

    expect(() => state.restore(other)).toThrow(new RangeError('The snapshot holds another board.'));
    expect(json(state.snapshot().boardCopy().occupiedCells())).toBe(before);
  });
});

describe('the photo outside the state', () => {
  it('should_answer_a_frozen_photo_with_no_state_method_when_a_caller_asks_the_engine', () => {
    const factory = new GameFactory(GameId.of('hexa-sort'), sortFactory(), new CountingMatchIds());
    const photo = factory.createGame().snapshot();
    const members = photo as unknown as Record<string, unknown>;

    expect(Object.isFrozen(photo)).toBe(true);
    for (const method of ['addPoints', 'clone', 'restore', 'placeOfferedStack', 'equals']) {
      expect(members[method]).toBeUndefined();
    }
  });

  it('should_hold_no_state_when_the_rules_resolve_or_reject_a_move', () => {
    const resolved = Resolution.resolved();
    const rejected = Resolution.rejected();

    expect('state' in resolved).toBe(false);
    expect([resolved.wasAccepted(), resolved.leadsTo()]).toEqual([true, Outcome.playing]);
    expect([rejected.wasAccepted(), rejected.leadsTo()]).toEqual([false, Outcome.playing]);
    expect(resolved.evaluated(Outcome.victory).leadsTo()).toBe(Outcome.victory);
  });

  it('should_score_from_the_photos_when_a_policy_gets_the_photos_before_and_after_a_turn', () => {
    const lines = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const linesBefore = lines.snapshot();
    lines.placePiece(new PlacePiece(TrayPosition.of(0), square(0, 0)));
    lines.clearLines([]);

    const sort = sortState({
      board: row(2, [[square(0, 0), stack(...tiles('red', 9))]]),
      offered: [stack('red')],
    });
    const sortBefore = sort.snapshot();
    sort.placeOfferedStack(square(1, 0));
    sort.moveRun(square(1, 0), square(0, 0));
    sort.clearStack(square(0, 0));

    const merge = mergeState([
      [hex(0, 0), 2],
      [hex(1, 0), 2],
    ]);
    const mergeBefore = merge.snapshot();
    merge.slide(Slide.of(HexAxis.q, SlideSense.forward), MergeTile.of(2048));

    const fit = fitFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);

    expect(
      new LinesScoring<ReturnType<typeof square>>().score(linesBefore, lines.snapshot()),
    ).toEqual(Score.of(1));
    expect(new SortScoring<ReturnType<typeof square>>().score(sortBefore, sort.snapshot())).toEqual(
      Score.of(100),
    );
    expect(new MergeScoring<HexCoord, HexAxis>().score(mergeBefore, merge.snapshot())).toEqual(
      Score.of(4),
    );
    expect(new FitScoring().score(fit.snapshot(), fit.snapshot())).toEqual(Score.of(0));
  });
});

// Issue #245: the photo has no public field either. A reader asks it a query with a business
// name, and each query gives a value object, the read-only board or a boolean.
describe('the queries of a photo', () => {
  it('should_answer_whose_state_and_which_match_it_shows_when_each_photo_is_asked', () => {
    const own = GameStateId.of(MATCH_ID);
    const photos = [
      linesFactory().createInitialState(MATCH_ID, own, BOARD_ID).snapshot(),
      fitFactory().createInitialState(MATCH_ID, own, BOARD_ID).snapshot(),
      sortFactory().createInitialState(MATCH_ID, own, BOARD_ID).snapshot(),
      mergeFactory().createInitialState(MATCH_ID, own, BOARD_ID).snapshot(),
    ];

    expect(
      photos.map((photo) => [
        photo.isPhotoOf(own),
        photo.isPhotoOf(OTHER_STATE),
        photo.belongsTo(MATCH_ID),
        photo.belongsTo(MatchId.of('another-match')),
      ]),
    ).toEqual([
      [true, false, true, false],
      [true, false, true, false],
      [true, false, true, false],
      [true, false, true, false],
    ]);
  });

  it('should_give_the_same_read_only_board_and_the_score_of_the_state_when_a_photo_is_asked', () => {
    const state = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    state.placePiece(new PlacePiece(TrayPosition.of(0), square(0, 0)));
    state.addPoints(Score.of(6));

    const photo = state.snapshot();

    expect(photo.boardCopy()).toBe(photo.boardCopy());
    expect(photo.boardCopy().equals(state.clone().snapshot().boardCopy())).toBe(true);
    expect(json(photo.boardCopy().occupiedCells())).toBe(json([[square(0, 0), red]]));
    expect(photo.scoreSoFar().equals(Score.of(6))).toBe(true);
  });
});

// Issue #245: the photo and the view keep every field private, as a state does.
// So the compiler refuses a read of a field of a photo or of a view.
describe('the fields of a photo and of a view', () => {
  it('should_reject_at_compile_time_when_a_caller_reads_a_field_of_a_photo_or_of_a_view', () => {
    const lines = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID).snapshot();
    const fit = fitFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID).snapshot();
    const sort = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID).snapshot();
    const merge = mergeFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID).snapshot();
    const readers = [
      // @ts-expect-error `BoardSnapshot.stateId` is private.
      () => lines.stateId,
      // @ts-expect-error `BoardSnapshot.matchId` is private.
      () => lines.matchId,
      // @ts-expect-error `BoardSnapshot.board` is private.
      () => lines.board,
      // @ts-expect-error `BoardSnapshot.score` is private.
      () => lines.score,
      // @ts-expect-error `LinesSnapshot.tray` is private.
      () => lines.tray,
      // @ts-expect-error `LinesSnapshot.streak` is private.
      () => lines.streak,
      // @ts-expect-error `LinesSnapshot.linesCleared` is private.
      () => lines.linesCleared,
      // @ts-expect-error `LinesSnapshot.cellsPlaced` is private.
      () => lines.cellsPlaced,
      // @ts-expect-error `LinesSnapshot.source` is private.
      () => lines.source,
      // @ts-expect-error `LinesView.tray` is private.
      () => lines.view().tray,
      // @ts-expect-error `FitSnapshot.placements` is private.
      () => fit.placements,
      // @ts-expect-error `FitSnapshot.moves` is private.
      () => fit.moves,
      // @ts-expect-error `FitView.remaining` is private.
      () => fit.view().remaining,
      // @ts-expect-error `FitView.placed` is private.
      () => fit.view().placed,
      // @ts-expect-error `SortSnapshot.offered` is private.
      () => sort.offered,
      // @ts-expect-error `SortSnapshot.goalsDone` is private.
      () => sort.goalsDone,
      // @ts-expect-error `SortSnapshot.goalsNeeded` is private.
      () => sort.goalsNeeded,
      // @ts-expect-error `SortSnapshot.clearedTiles` is private.
      () => sort.clearedTiles,
      // @ts-expect-error `SortSnapshot.placedAt` is private.
      () => sort.placedAt,
      // @ts-expect-error `SortSnapshot.source` is private.
      () => sort.source,
      // @ts-expect-error `SortView.offered` is private.
      () => sort.view().offered,
      // @ts-expect-error `SortView.goalsDone` is private.
      () => sort.view().goalsDone,
      // @ts-expect-error `SortView.goalsNeeded` is private.
      () => sort.view().goalsNeeded,
      // @ts-expect-error `MergeSnapshot.targetReached` is private.
      () => merge.targetReached,
      // @ts-expect-error `MergeSnapshot.merged` is private.
      () => merge.merged,
      // @ts-expect-error `MergeSnapshot.tiles` is private.
      () => merge.tiles,
      // @ts-expect-error `MergeView.targetReached` is private.
      () => merge.view().targetReached,
    ];

    expect(readers).toHaveLength(27);
  });
});

// R8: the fields of the four states are private. A reader outside a state reads its photo.
// So the compiler refuses a read, a write, an array change or a draw on a field of a state.
describe('the fields of a state', () => {
  it('should_reject_at_compile_time_when_a_caller_reads_or_changes_a_field_of_a_state', () => {
    const lines = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const fit = fitFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const sort = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const merge = mergeFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const readers = [
      // @ts-expect-error `LinesState.board` is private.
      () => lines.board,
      // @ts-expect-error `LinesState.tray` is private.
      () => lines.tray,
      // @ts-expect-error `LinesState.source` is private.
      () => lines.source.take(),
      // @ts-expect-error `LinesState.streak` is private.
      () => lines.streak,
      // @ts-expect-error `LinesState.linesCleared` is private.
      () => lines.linesCleared,
      // @ts-expect-error `LinesState.cellsPlaced` is private.
      () => lines.cellsPlaced,
      // @ts-expect-error `LinesState.score` is private.
      () => (lines.score = 1),
      // @ts-expect-error `FitState.board` is private.
      () => fit.board,
      // @ts-expect-error `FitState.moves` is private.
      () => (fit.moves += 1),
      // @ts-expect-error `FitState.score` is private.
      () => fit.score,
      // @ts-expect-error `SortState.board` is private.
      () => sort.board,
      // @ts-expect-error `SortState.source` is private.
      () => sort.source.take(),
      // @ts-expect-error `SortState.goalsNeeded` is private.
      () => sort.goalsNeeded,
      // @ts-expect-error `SortState.offered` is private.
      () => sort.offered,
      // @ts-expect-error `SortState.goalsDone` is private.
      () => sort.goalsDone,
      // @ts-expect-error `SortState.clearedTiles` is private.
      () => sort.clearedTiles.push(1),
      // @ts-expect-error `SortState.placedAt` is private.
      () => sort.placedAt,
      // @ts-expect-error `SortState.score` is private.
      () => sort.score,
      // @ts-expect-error `MergeState.board` is private.
      () => merge.board,
      // @ts-expect-error `MergeState.tiles` is private.
      () => merge.tiles.take(),
      // @ts-expect-error `MergeState.targetReached` is private.
      () => merge.targetReached,
      // @ts-expect-error `MergeState.merged` is private.
      () => merge.merged,
      // @ts-expect-error `MergeState.score` is private.
      () => merge.score,
    ];

    expect(readers).toHaveLength(23);
  });
});
