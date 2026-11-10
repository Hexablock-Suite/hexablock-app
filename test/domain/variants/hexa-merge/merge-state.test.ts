/** @jest-environment node */
import { Score } from '../../../../src/domain/engine/score';
import { hex, HexAxis } from '../../../../src/domain/engine/hex-topology';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { GameStateId } from '../../../../src/domain/engine/game-state-id';
import { MatchId } from '../../../../src/domain/engine/match-id';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { MergeState } from '../../../../src/domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import { NewTile } from '../../../../src/domain/variants/hexa-merge/new-tile';
import { SlideSense, Slide } from '../../../../src/domain/variants/hexa-merge/slide';
import {
  hexTopology,
  mergeState,
  noNewTiles,
  values,
  valueOf,
  type HexMergeState,
} from '../../../support/variants/hexa-merge/merge-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { STATE_ID } from '../../../support/engine/entity-ids';

// R7: the Merge state is an entity. It keeps its object: a new tile and a slide change it in place.
// A refused input leaves the whole state as it was.

const key = (q: number, r: number) => hexTopology.key(hex(q, r));

function draws(...made: [number, number][]) {
  return new FixedListPieceSource<NewTile<MergeTile>>(
    made.map(([place, value]) => NewTile.of(place, MergeTile.of(value))),
  );
}

// Everything that a refused input must leave unchanged.
function facts(state: HexMergeState) {
  return {
    board: state
      .snapshot()
      .board.cells()
      .map(([at, tile]) => [hexTopology.key(at), tile.points().value]),
    left: state.snapshot().tiles.hasNext(),
    targetReached: state.snapshot().targetReached,
    merged: state.snapshot().merged.map((tile) => tile.points().value),
    score: state.snapshot().score,
  };
}

describe('MergeState', () => {
  it('should_put_the_drawn_tile_on_the_empty_cell_that_the_draw_picks_when_a_new_tile_is_added', () => {
    const empty = hexTopology.region(RegionSize.of(2)).cells.filter((c) => !c.equals(hex(0, 0)));
    const state = mergeState([[hex(0, 0), 2]], 2, draws([0, 4], [0.999, 2]));

    state.addNewTile();
    state.addNewTile();

    const first = empty[0]!;
    const last = empty[empty.length - 1]!;
    expect(values(state.snapshot())).toEqual({
      [key(0, 0)]: 2,
      [hexTopology.key(first)]: 4,
      [hexTopology.key(last)]: 2,
    });
    expect(state.snapshot().tiles.hasNext()).toBe(false);
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
    expect(full.snapshot().tiles.hasNext()).toBe(true);
  });

  it('should_merge_the_tiles_in_place_and_keep_the_board_and_the_source_when_tiles_slide', () => {
    const state = mergeState([
      [hex(-1, 0), 2],
      [hex(0, 0), 2],
      [hex(0, 1), 4],
    ]);
    const { board, tiles } = state.snapshot();
    const before = state.clone();

    const result: unknown = state.slide(
      Slide.of(HexAxis.q, SlideSense.forward),
      MergeTile.of(2048),
    );

    expect(result).toBeUndefined();
    expect(values(state.snapshot())).toEqual({ [key(1, 0)]: 4, [key(0, 1)]: 4 });
    expect(state.snapshot().merged).toEqual([MergeTile.of(4)]);
    expect(state.snapshot().targetReached).toBe(false);
    // The board keeps its id, and the source keeps its position: the slide draws nothing.
    expect(state.snapshot().board.equals(board)).toBe(true);
    expect(state.snapshot().tiles === tiles).toBe(true);
    expect(values(before.snapshot())).toEqual({ [key(-1, 0)]: 2, [key(0, 0)]: 2, [key(0, 1)]: 4 });
  });

  // `Board.cells()` lists the cells in first-write order, and `MoveResult.cells` shows it.
  // A slide vacates every tile and then writes the packed tiles line by line.
  it('should_list_the_cells_in_the_order_of_the_packed_lines_when_tiles_slide_in_place', () => {
    const state = mergeState([
      [hex(1, -1), 2],
      [hex(-1, 0), 4],
      [hex(0, 1), 8],
    ]);

    state.slide(Slide.of(HexAxis.q, SlideSense.backward), MergeTile.of(2048));

    expect(
      state
        .snapshot()
        .board.cells()
        .map(([at, tile]) => [hexTopology.key(at), valueOf(tile)]),
    ).toEqual([
      [key(-1, 0), 4],
      [key(-1, 1), 8],
      [key(0, -1), 2],
    ]);
  });

  it('should_set_the_target_flag_when_a_merge_makes_the_target_tile', () => {
    const state = mergeState([
      [hex(0, 0), 8],
      [hex(1, 0), 8],
    ]);

    state.slide(Slide.of(HexAxis.q, SlideSense.backward), MergeTile.of(16));
    const later = mergeState([[hex(0, 0), 2]]);
    later.slide(Slide.of(HexAxis.q, SlideSense.forward), MergeTile.of(16));

    expect(state.snapshot().targetReached).toBe(true);
    expect(state.snapshot().merged).toEqual([MergeTile.of(16)]);
    expect(later.snapshot().targetReached).toBe(false);
    state.slide(Slide.of(HexAxis.q, SlideSense.forward), MergeTile.of(16));
    expect([state.snapshot().targetReached, state.snapshot().merged]).toEqual([true, []]);
  });

  it('should_tell_whether_a_slide_changes_the_board_when_a_slide_is_asked', () => {
    const state = mergeState([[hex(1, 0), 2]]);

    expect(state.canSlide(Slide.of(HexAxis.q, SlideSense.backward))).toBe(true);
    expect(state.canSlide(Slide.of(HexAxis.q, SlideSense.forward))).toBe(false);
    expect(state.canSlide(Slide.of('w' as unknown as HexAxis, SlideSense.forward))).toBe(false);
  });

  it('should_throw_a_range_error_and_keep_the_state_when_the_slide_changes_no_cell', () => {
    const state = mergeState([[hex(1, 0), 2]]);
    const before = facts(state);

    expect(() => state.slide(Slide.of(HexAxis.q, SlideSense.forward), MergeTile.of(16))).toThrow(
      new RangeError('The slide changes no cell of the board.'),
    );
    expect(() =>
      state.slide(Slide.of('w' as unknown as HexAxis, SlideSense.forward), MergeTile.of(16)),
    ).toThrow(new RangeError('The slide changes no cell of the board.'));
    expect(facts(state)).toEqual(before);
  });

  it('should_add_the_points_and_refuse_a_total_above_the_largest_safe_integer_when_points_are_added', () => {
    const state = mergeState([]);

    state.addPoints(Score.of(4));
    state.addPoints(Score.of(8));

    expect(state.snapshot().score).toEqual(Score.of(12));
    expect(() => state.addPoints(Score.of(Number.MAX_SAFE_INTEGER))).toThrow(
      new RangeError('The sum of two scores cannot pass the largest safe integer.'),
    );
    expect(state.snapshot().score).toEqual(Score.of(12));
  });

  // The state has no check of its own: a `Score` is valid when it exists (issue #203).
  it('should_keep_the_score_when_a_state_is_built_with_a_score', () => {
    const board = mergeState([]).snapshot().board.clone();

    const state = new MergeState(STATE_ID, MATCH_ID, board, noNewTiles(), false, [], Score.of(7));

    expect(state.snapshot().score).toEqual(Score.of(7));
    expect(new MergeState(STATE_ID, MATCH_ID, board, noNewTiles()).snapshot().score).toEqual(
      Score.of(0),
    );
  });

  // The state has its own `GameStateId`, and it still knows its match (classes.md decision 26).
  it('should_be_the_same_state_when_two_states_have_one_state_id_whatever_they_hold', () => {
    const stateId = GameStateId.of('state-a');
    const first = mergeState([[hex(1, 0), 2]], 2, noNewTiles(), MATCH_ID, stateId);
    const second = mergeState([], 2, noNewTiles(), MATCH_ID, stateId);
    const before = first.clone();
    first.slide(Slide.of(HexAxis.q, SlideSense.backward), MergeTile.of(16));

    expect([first.equals(second), second.equals(first), first.equals(before)]).toEqual([
      true,
      true,
      true,
    ]);
    expect([
      first.belongsTo(MATCH_ID),
      first.snapshot().board.equals(before.snapshot().board),
    ]).toEqual([true, true]);
  });

  it('should_be_another_state_when_two_states_of_one_match_have_different_state_ids', () => {
    const matchId = MatchId.of('m-a');
    const first = mergeState([], 2, noNewTiles(), matchId, GameStateId.of('state-a'));
    const second = mergeState([], 2, noNewTiles(), matchId, GameStateId.of('state-b'));

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect([
      first.belongsTo(MatchId.of('m-a')),
      second.belongsTo(MatchId.of('m-a')),
      first.belongsTo(MatchId.of('m-b')),
    ]).toEqual([true, true, false]);
  });
});
