/** @jest-environment node */
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Score } from '../../../../src/domain/engine/score';
import { GameId } from '../../../../src/domain/engine/game-id';
import { HexGeometry } from '../../../../src/domain/engine/hex-geometry';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import {
  MergeFactory,
  START_TILES,
} from '../../../../src/domain/variants/hexa-merge/merge-factory';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import { firstValidMove, startVariant } from '../../../support/engine/variant-game';
import {
  mergeFactory,
  mergeStateOf,
  valueOf,
  values,
} from '../../../support/variants/hexa-merge/merge-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';

// A Merge factory on a hexagon of `size` rings, with the target 2048.
function sizedMergeFactory(size: number, fourChance?: number) {
  return new MergeFactory(new HexGeometry(), {
    size: RegionSize.of(size),
    seed: 1,
    target: MergeTile.of(2048),
    fourChance,
  });
}

// The Merge factory creates the whole family of Hexa Merge (issue 99, classes.md decision 31).

describe('MergeFactory', () => {
  it('should_start_a_game_with_two_tiles_that_plays_one_slide_when_the_merge_factory_builds_it', () => {
    const factory = mergeFactory(7);

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { engine, rules, publisher } = startVariant(factory);
    const slide = firstValidMove(rules, mergeStateOf(engine.snapshot()));
    const outcome = engine.play(slide);
    const after = engine.snapshot();

    expect(factory.gameId.equals(GameId.of('hexa-merge'))).toBe(true);
    expect(factory.createBoard(BOARD_ID).shape.cells).toHaveLength(7);
    expect(Object.values(values(initial.snapshot()))).toHaveLength(2);
    expect(Object.values(values(initial.snapshot())).every((v) => v === 2 || v === 4)).toBe(true);
    expect(outcome).toBe(Outcome.playing);
    expect(values(after)).not.toEqual(values(initial.snapshot()));
    // The score is the sum of the merged values: the factory picks the Merge scoring.
    expect(after.score).toEqual(
      Score.of(after.merged.reduce((sum, tile) => sum + valueOf(tile), 0)),
    );
    expect(after.tiles.hasNext()).toBe(true);
    expect(publisher.events).toEqual([]);
  });

  it('should_give_the_same_game_when_two_merge_factories_share_a_seed', () => {
    const play = (seed: number) => {
      const { engine, rules } = startVariant(mergeFactory(seed));
      const start = values(engine.snapshot());
      engine.play(firstValidMove(rules, mergeStateOf(engine.snapshot())));
      return [start, values(engine.snapshot())];
    };

    expect(play(9)).toEqual(play(9));
    expect(mergeFactory(9).createPieceSource().take().piece).toEqual(
      mergeFactory(9).createPieceSource().take().piece,
    );
  });

  it('should_throw_a_range_error_when_the_merge_settings_hold_a_seed_that_is_not_a_32_bit_integer', () => {
    for (const seed of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, -1, 2 ** 53]) {
      const message = `A seed must be an integer from 0 to 4294967295, not ${seed}.`;

      expect(() => mergeFactory(seed).createPieceSource()).toThrow(new RangeError(message));
      expect(() => mergeFactory(seed).createInitialState(MATCH_ID, STATE_ID, BOARD_ID)).toThrow(
        new RangeError(message),
      );
    }
  });

  it('should_give_the_game_of_seed_zero_when_the_merge_settings_hold_a_negative_zero_seed', () => {
    expect(
      values(mergeFactory(-0).createInitialState(MATCH_ID, STATE_ID, BOARD_ID).snapshot()),
    ).toEqual(values(mergeFactory(0).createInitialState(MATCH_ID, STATE_ID, BOARD_ID).snapshot()));
  });

  it('should_throw_a_range_error_when_the_merge_settings_hold_a_chance_of_a_four_that_is_not_a_number', () => {
    const factory = sizedMergeFactory(2, Number.NaN);
    const message = 'The chance of a 4 must be a number from 0 to 1, not NaN.';

    expect(() => factory.createPieceSource()).toThrow(new RangeError(message));
    expect(() => factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID)).toThrow(
      new RangeError(message),
    );
  });

  it('should_fill_every_cell_and_stop_when_the_board_has_fewer_cells_than_the_start_tiles', () => {
    // A board with no empty cell gets no new tile, so the rest of the start tiles do not appear.
    const factory = sizedMergeFactory(1);

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);

    expect(START_TILES).toBe(2);
    expect(factory.createBoard(BOARD_ID).shape.cells).toHaveLength(1);
    expect(Object.keys(values(initial.snapshot()))).toEqual(['0,0']);
    expect([2, 4]).toContain(values(initial.snapshot())['0,0']);
  });
});
