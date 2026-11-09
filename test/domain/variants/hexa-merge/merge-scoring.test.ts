/** @jest-environment node */
import { hex, type HexAxis, type HexCoord } from '../../../../src/domain/engine/hex-topology';
import { MergeScoring } from '../../../../src/domain/variants/hexa-merge/merge-scoring';
import { mergeTileSource } from '../../../../src/domain/variants/hexa-merge/merge-tile-source';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import { Slide } from '../../../../src/domain/variants/hexa-merge/slide';
import { mergeGame, mergeState, values } from '../../../support/variants/hexa-merge/merge-game';

// The scoring of Hexa Merge (issue 97, APP-FR-06, statement §1.4).
// It codes the accepted rule of issue #59 (D22): a slide scores the sum of the values that its merges make,
// and the new tile adds nothing. The tests play through `GameEngine.play()` with a fixed seed.

const east = Slide.of<HexAxis>('q', 'forward');

// Plays one east slide on row r = 0 with the given tiles from the west edge,
// with new tiles from a fixed seed, and returns the state after it.
function slideRow(tiles: readonly number[], fourChance?: number) {
  const row: [HexCoord, number][] = tiles.map((value, i) => [hex(i - 2, 0), value]);
  const { engine } = mergeGame(
    mergeState(row, 3, mergeTileSource(2026, fourChance)),
    MergeTile.of(2048),
    new MergeScoring<HexCoord, HexAxis>(),
  );
  engine.play(east);
  return engine.snapshot();
}

function total(state: ReturnType<typeof slideRow>): number {
  return Object.values(values(state)).reduce((sum, value) => sum + value, 0);
}

describe('Hexa Merge scoring', () => {
  it('should_score_the_value_of_the_merged_tile_when_two_equal_tiles_merge', () => {
    const state = slideRow([2, 2]);

    expect(state.merged.map((tile) => tile.value)).toEqual([4]);
    expect(state.score).toBe(4);
  });

  it('should_score_the_sum_of_the_merged_values_when_one_slide_makes_two_merges', () => {
    const state = slideRow([2, 2, 4, 4]);

    expect(state.merged.map((tile) => tile.value).sort()).toEqual([4, 8]);
    expect(state.score).toBe(12);
  });

  it('should_score_each_merge_when_one_slide_makes_two_merges_of_the_same_value', () => {
    // A tile merges at most once per move, so 2 2 2 2 gives two tiles of 4, not one 8.
    const state = slideRow([2, 2, 2, 2]);

    expect(state.merged.map((tile) => tile.value)).toEqual([4, 4]);
    expect(state.score).toBe(8);
  });

  it('should_score_zero_when_the_slide_moves_tiles_but_merges_none', () => {
    const state = slideRow([2, 4]);

    expect(state.merged).toEqual([]);
    expect(state.score).toBe(0);
  });

  it('should_add_nothing_for_the_new_tile_when_a_tile_appears_after_the_slide', () => {
    // A chance of 1 makes the new tile a 4, so the board total grows by 4 and the score does not.
    const merged = slideRow([2, 2], 1);
    const moved = slideRow([2], 1);

    expect(total(merged)).toBe(8);
    expect(merged.score).toBe(4);
    expect(total(moved)).toBe(6);
    expect(moved.score).toBe(0);
  });
});
