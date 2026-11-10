/** @jest-environment node */
import { Outcome } from '../../../src/domain/engine/outcome';
import { Moves } from '../../../src/domain/engine/moves';
import { Score } from '../../../src/domain/engine/score';
import type { Board } from '../../../src/domain/engine/board';
import { BoardId } from '../../../src/domain/engine/board-id';
import { GameStateId } from '../../../src/domain/engine/game-state-id';
import { hex, HexAxis, type HexCoord } from '../../../src/domain/engine/hex-topology';
import { Resolution } from '../../../src/domain/engine/resolution';
import { Turns } from '../../../src/domain/engine/turns';
import { FitScoring } from '../../../src/domain/variants/hexa-fit/fit-scoring';
import { Placement } from '../../../src/domain/variants/hexa-fit/placement';
import { LinesScoring } from '../../../src/domain/variants/hexa-lines/lines-scoring';
import { PlacePiece } from '../../../src/domain/variants/hexa-lines/place-piece';
import { MergeScoring } from '../../../src/domain/variants/hexa-merge/merge-scoring';
import { MergeTile } from '../../../src/domain/variants/hexa-merge/merge-tile';
import { SlideSense, Slide } from '../../../src/domain/variants/hexa-merge/slide';
import { ClearedStacks } from '../../../src/domain/variants/hexa-sort/cleared-stacks';
import { SortScoring } from '../../../src/domain/variants/hexa-sort/sort-scoring';
import { BOARD_ID, CountingBoardIds, CountingStateIds } from '../../support/engine/entity-ids';
import { RecordingPublisher } from '../../support/engine/fake-game';
import { CountingMatchIds, MATCH_ID } from '../../support/engine/match-id';
import { square } from '../../support/engine/square-topology';
import { A, fitFactory } from '../../support/variants/hexa-fit/fit-game';
import { linesFactory, red } from '../../support/variants/hexa-lines/lines-game';
import { mergeFactory, mergeState } from '../../support/variants/hexa-merge/merge-game';
import {
  row,
  sortFactory,
  sortState,
  stack,
  tiles,
} from '../../support/variants/hexa-sort/sort-game';
import { GameFactory } from '../../../src/domain/engine/game-factory';

// R8, step 2 of the game state (classes.md decisions 7, 26, 29 and 34).
// Each state gives one immutable photo of itself with `snapshot()`, and it takes that photo back
// with `restore()`. The photo is the Memento of the undo, the screen data of `view()` and the
// answer of `GameEngine.snapshot()`. It carries domain values and no behavior of the state.

const json = (value: unknown): string => JSON.stringify(value);
const OTHER_STATE = GameStateId.of('another-state');

describe('the photo of a state', () => {
  it('should_hold_the_lines_data_in_a_frozen_photo_when_a_lines_state_takes_its_snapshot', () => {
    const state = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    state.placePiece(new PlacePiece(0, square(0, 0)));

    const photo = state.snapshot();

    expect(Object.isFrozen(photo)).toBe(true);
    expect(Object.isFrozen(photo.tray)).toBe(true);
    expect([photo.stateId.equals(OTHER_STATE), photo.matchId.equals(MATCH_ID)]).toEqual([
      true,
      true,
    ]);
    expect(json([photo.board.cells(), photo.score, photo.tray.length])).toBe(
      json([[[square(0, 0), red]], Score.of(0), 2]),
    );
    expect([photo.streak, photo.linesCleared, photo.cellsPlaced]).toEqual([0, 0, 1]);
    expect(json(photo.view())).toBe(json({ tray: photo.tray }));
  });

  it('should_hold_the_sort_data_in_a_frozen_photo_when_a_sort_state_takes_its_snapshot', () => {
    const state = sortState({ board: row(2), offered: [stack('red'), stack('blue')] });
    state.placeOfferedStack(square(1, 0));

    const photo = state.snapshot();

    expect(Object.isFrozen(photo)).toBe(true);
    expect(Object.isFrozen(photo.clearedTiles)).toBe(true);
    expect(json([photo.offered, photo.goalsDone, photo.clearedTiles, photo.placedAt])).toBe(
      json([state.snapshot().offered, ClearedStacks.of(0), [], square(1, 0)]),
    );
    expect(photo.goalsDone).toBeInstanceOf(ClearedStacks);
    expect(photo.goalsNeeded.isReachedBy(ClearedStacks.of(5))).toBe(true);
    expect(json(photo.view())).toBe(
      json({
        offered: photo.offered,
        goalsDone: ClearedStacks.of(0),
        goalsNeeded: photo.goalsNeeded,
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
    expect(Object.isFrozen(photo.merged)).toBe(true);
    expect([photo.targetReached, photo.merged.map((tile) => tile.points().value)]).toEqual([
      true,
      [4],
    ]);
    expect(json(photo.view())).toBe(json({ targetReached: true }));
  });

  it('should_hold_the_fit_data_in_a_frozen_photo_when_a_fit_state_takes_its_snapshot', () => {
    const state = fitFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const { topology } = state.snapshot().board;
    const placement = Placement.of(Turns.of(0), square(0, 0), topology);
    state.place(A, placement);
    state.countMove();

    const photo = state.snapshot();

    expect(Object.isFrozen(photo)).toBe(true);
    expect(Object.isFrozen(photo.placements)).toBe(true);
    expect(photo.moves).toBeInstanceOf(Moves);
    expect(photo.moves.equals(Moves.of(1))).toBe(true);
    expect(
      photo.placements.map(([id, at]) => [id.equals(A), at.equals(placement, topology)]),
    ).toEqual([[true, true]]);
    expect(json(photo.view())).toBe(json({ remaining: [], placed: [A] }));
  });

  it('should_keep_the_photo_and_the_state_apart_when_either_one_changes', () => {
    const state = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    const before = json([photo.board.cells(), photo.tray, photo.score]);

    state.placePiece(new PlacePiece(0, square(0, 0)));
    state.addPoints(Score.of(7));
    expect(json([photo.board.cells(), photo.tray, photo.score])).toBe(before);

    const later = state.snapshot();
    const shown = json(later.board.cells());
    (later.board as Board<typeof red, ReturnType<typeof square>>).occupy(square(2, 2), red);
    expect(json(state.snapshot().board.cells())).toBe(shown);
  });
});

describe('the restore of a state from its photo', () => {
  it('should_give_back_the_board_the_score_the_tray_and_the_next_piece_when_lines_restores', () => {
    const state = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    // The third piece empties the tray, so the source draws three new pieces.
    for (const col of [0, 1, 2]) state.placePiece(new PlacePiece(0, square(col, 0)));
    state.clearLines([[square(0, 0), square(1, 0), square(2, 0)]]);
    state.addPoints(Score.of(13));

    state.restore(photo);

    const back = state.snapshot();
    expect(json([back.board.cells(), back.score, back.tray, back.streak])).toBe(
      json([photo.board.cells(), photo.score, photo.tray, photo.streak]),
    );
    expect([back.linesCleared, back.cellsPlaced]).toEqual([photo.linesCleared, photo.cellsPlaced]);
    expect(json(back.source.clone().next())).toBe(json(photo.source.clone().next()));
  });

  it('should_give_back_the_offered_stack_and_the_source_when_sort_restores', () => {
    const state = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    state.placeOfferedStack(square(0, 0));
    state.addPoints(Score.of(4));

    state.restore(photo);

    const back = state.snapshot();
    expect(json([back.board.cells(), back.score, back.offered, back.goalsDone])).toBe(
      json([photo.board.cells(), photo.score, photo.offered, photo.goalsDone]),
    );
    expect(json([back.clearedTiles, back.placedAt])).toBe(
      json([photo.clearedTiles, photo.placedAt]),
    );
    expect(json(back.source.clone().next())).toBe(json(photo.source.clone().next()));
  });

  it('should_give_back_the_tiles_and_the_tile_source_when_merge_restores', () => {
    const state = mergeFactory(5).createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    state.addNewTile();
    state.addNewTile();
    state.addPoints(Score.of(8));

    state.restore(photo);

    const back = state.snapshot();
    expect(json([back.board.cells(), back.score, back.targetReached, back.merged])).toBe(
      json([photo.board.cells(), photo.score, photo.targetReached, photo.merged]),
    );
    expect(json(back.tiles.clone().next())).toBe(json(photo.tiles.clone().next()));
  });

  it('should_give_back_the_placements_and_the_moves_when_fit_restores', () => {
    const state = fitFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const photo = state.snapshot();
    state.place(A, Placement.of(Turns.of(0), square(0, 0), photo.board.topology));
    state.countMove();

    state.restore(photo);

    const back = state.snapshot();
    expect(json([back.board.cells(), back.score, back.moves, back.view()])).toBe(
      json([photo.board.cells(), photo.score, photo.moves, photo.view()]),
    );
    expect(back.placements).toEqual([]);
    expect(state.placementOf(A)).toBeUndefined();
  });

  it('should_throw_and_keep_the_state_when_the_photo_belongs_to_another_state', () => {
    const state = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const stranger = sortFactory()
      .createInitialState(MATCH_ID, GameStateId.of('stranger'), BOARD_ID)
      .snapshot();
    state.placeOfferedStack(square(0, 0));
    const before = json(state.snapshot().board.cells());

    expect(() => state.restore(stranger)).toThrow(
      new RangeError('The snapshot belongs to another state.'),
    );
    expect(json(state.snapshot().board.cells())).toBe(before);
  });

  it('should_throw_and_keep_the_board_when_the_photo_holds_another_board', () => {
    const state = sortFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const other = sortFactory()
      .createInitialState(MATCH_ID, OTHER_STATE, BoardId.of('another-board'))
      .snapshot();
    state.placeOfferedStack(square(0, 0));
    const before = json(state.snapshot().board.cells());

    expect(() => state.restore(other)).toThrow(new RangeError('The snapshot holds another board.'));
    expect(json(state.snapshot().board.cells())).toBe(before);
  });
});

describe('the photo outside the state', () => {
  it('should_answer_a_frozen_photo_with_no_state_method_when_a_caller_asks_the_engine', () => {
    const factory = new GameFactory(
      sortFactory(),
      new CountingMatchIds(),
      new CountingStateIds(),
      new CountingBoardIds(),
      new RecordingPublisher(),
    );
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
    expect([resolved.accepted, resolved.outcome]).toEqual([true, Outcome.playing]);
    expect([rejected.accepted, rejected.outcome]).toEqual([false, Outcome.playing]);
    expect(resolved.evaluated(Outcome.victory).outcome).toBe(Outcome.victory);
  });

  it('should_score_from_the_photos_when_a_policy_gets_the_photos_before_and_after_a_turn', () => {
    const lines = linesFactory().createInitialState(MATCH_ID, OTHER_STATE, BOARD_ID);
    const linesBefore = lines.snapshot();
    lines.placePiece(new PlacePiece(0, square(0, 0)));
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
      () => lines.source.next(),
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
      () => sort.source.next(),
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
      () => merge.tiles.next(),
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
