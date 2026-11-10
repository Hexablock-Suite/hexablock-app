/** @jest-environment node */
import { hex, type HexAxis } from '../../../../src/domain/engine/hex-topology';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { MergeState } from '../../../../src/domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import type { NewTile } from '../../../../src/domain/variants/hexa-merge/new-tile';
import { Slide } from '../../../../src/domain/variants/hexa-merge/slide';
import {
  hexTopology,
  mergeState,
  noNewTiles,
  values,
  type HexMergeState,
} from '../../../support/variants/hexa-merge/merge-game';

// R7: the Merge state is an entity. A new tile changes it in place. A slide gives the state
// after the slide, as the Fit moves do, and leaves the state before it unchanged.
// A refused input leaves the whole state as it was.

const key = (q: number, r: number) => hexTopology.key(hex(q, r));

function draws(...made: [number, number][]) {
  return new FixedListPieceSource<NewTile<MergeTile>>(
    made.map(([place, value]) => ({ place, tile: MergeTile.of(value) })),
  );
}

// Everything that a refused input must leave unchanged.
function facts(state: HexMergeState) {
  return {
    board: state.board.cells().map(([at, tile]) => [hexTopology.key(at), tile.points()]),
    left: state.tiles.hasNext(),
    targetReached: state.targetReached,
    merged: state.merged.map((tile) => tile.points()),
    score: state.score,
  };
}

describe('MergeState', () => {
  it('should_put_the_drawn_tile_on_the_empty_cell_that_the_draw_picks_when_a_new_tile_is_added', () => {
    const empty = hexTopology
      .region(RegionSize.of(2))
      .cells.filter((c) => key(c.q, c.r) !== key(0, 0));
    const state = mergeState([[hex(0, 0), 2]], 2, draws([0, 4], [0.999, 2]));

    state.addNewTile();
    state.addNewTile();

    const first = empty[0]!;
    const last = empty[empty.length - 1]!;
    expect(values(state)).toEqual({
      [key(0, 0)]: 2,
      [hexTopology.key(first)]: 4,
      [hexTopology.key(last)]: 2,
    });
    expect(state.tiles.hasNext()).toBe(false);
  });

  it('should_keep_the_board_when_the_source_has_ended_and_a_new_tile_is_asked', () => {
    const state = mergeState([[hex(0, 0), 2]], 2, noNewTiles());
    const before = facts(state);

    state.addNewTile();

    expect(facts(state)).toEqual(before);
  });

  it('should_keep_the_board_and_read_no_tile_when_the_board_is_full_and_a_new_tile_is_asked', () => {
    const cells = hexTopology.region(RegionSize.of(1)).cells;
    const full = mergeState(
      cells.map((c, i): [typeof c, number] => [c, 2 ** (i + 1)]),
      1,
      draws([0, 2]),
    );
    const before = facts(full);

    full.addNewTile();

    expect(facts(full)).toEqual(before);
    expect(full.tiles.hasNext()).toBe(true);
  });

  it('should_give_the_merged_state_and_keep_the_state_before_when_tiles_slide', () => {
    const state = mergeState([
      [hex(-1, 0), 2],
      [hex(0, 0), 2],
      [hex(0, 1), 4],
    ]);
    const before = facts(state);

    const after = state.slide(Slide.of<HexAxis>('q', 'forward'), MergeTile.of(2048));

    expect(values(after)).toEqual({ [key(1, 0)]: 4, [key(0, 1)]: 4 });
    expect(after.merged).toEqual([MergeTile.of(4)]);
    expect(after.targetReached).toBe(false);
    expect(after.tiles).toBe(state.tiles);
    expect(facts(state)).toEqual(before);
  });

  it('should_set_the_target_flag_when_a_merge_makes_the_target_tile', () => {
    const state = mergeState([
      [hex(0, 0), 8],
      [hex(1, 0), 8],
    ]);

    const after = state.slide(Slide.of<HexAxis>('q', 'backward'), MergeTile.of(16));
    const later = mergeState([[hex(0, 0), 2]]);

    expect(after.targetReached).toBe(true);
    expect(after.merged).toEqual([MergeTile.of(16)]);
    expect(later.slide(Slide.of<HexAxis>('q', 'forward'), MergeTile.of(16)).targetReached).toBe(
      false,
    );
  });

  it('should_tell_whether_a_slide_changes_the_board_when_a_slide_is_asked', () => {
    const state = mergeState([[hex(1, 0), 2]]);

    expect(state.canSlide(Slide.of<HexAxis>('q', 'backward'))).toBe(true);
    expect(state.canSlide(Slide.of<HexAxis>('q', 'forward'))).toBe(false);
    expect(state.canSlide(Slide.of('w' as HexAxis, 'forward'))).toBe(false);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_the_slide_changes_no_cell', () => {
    const state = mergeState([[hex(1, 0), 2]]);
    const before = facts(state);

    expect(() => state.slide(Slide.of<HexAxis>('q', 'forward'), MergeTile.of(16))).toThrow(
      new RangeError('The slide changes no cell of the board.'),
    );
    expect(() => state.slide(Slide.of('w' as HexAxis, 'forward'), MergeTile.of(16))).toThrow(
      new RangeError('The slide changes no cell of the board.'),
    );
    expect(facts(state)).toEqual(before);
  });

  it('should_add_the_points_and_refuse_points_that_are_not_finite_when_points_are_added', () => {
    const state = mergeState([]);

    state.addPoints(4);
    state.addPoints(8);

    expect(state.score).toBe(12);
    expect(() => state.addPoints(Number.NEGATIVE_INFINITY)).toThrow(
      new RangeError('The points of a turn must be a finite number, not -Infinity.'),
    );
    expect(state.score).toBe(12);
  });

  it('should_throw_a_range_error_when_a_state_is_built_with_a_score_that_is_not_finite', () => {
    const board = mergeState([]).board;

    expect(() => new MergeState(board, noNewTiles(), false, [], Number.NaN)).toThrow(
      new RangeError('The score of a state must be a finite number, not NaN.'),
    );
  });
});
