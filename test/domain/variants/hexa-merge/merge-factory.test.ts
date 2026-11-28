/** @jest-environment node */
import { Outcome } from '../../../../src/domain/engine/events/outcome';
import { Score } from '../../../../src/domain/shared/score';
import { GameId } from '../../../../src/domain/shared/game-id';
import { HexGeometry } from '../../../../src/domain/engine/geometry/hex-geometry';
import { RegionSize } from '../../../../src/domain/engine/geometry/region-size';
import { Chance } from '../../../../src/domain/variants/hexa-merge/chance';
import {
  MergeFactory,
  MergeSettings,
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
import { seededRandom, StepRandom } from '../../../support/engine/step-random';
import { playMove } from '../../../support/engine/play-move';

// A Merge factory on a hexagon of 2 rings, with the target 2048.
// Each match draws its seed from `random` (issue #417).
function factoryWith(random: StepRandom) {
  return new MergeFactory(
    new HexGeometry(),
    MergeSettings.of(RegionSize.of(2), MergeTile.of(2048)),
    random,
  );
}

// The tiles of a new match of `factory`: the start tiles by cell, and the next ten new tiles
// of its source on a list of seven cells.
function tilesOfMatch(factory: ReturnType<typeof factoryWith>): unknown[] {
  const photo = startVariant(factory).engine.snapshot();
  const cells = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const next: [string, number][] = [];
  for (const draw of photo.tileSource()) {
    const [cell, tile] = draw.appearsOn(cells);
    next.push([cell, valueOf(tile)]);
    if (next.length === 10) break;
  }
  return [values(photo), next];
}

// A Merge factory on a hexagon of `size` rings, with the target 2048.
function sizedMergeFactory(size: number, fourChance?: number) {
  return new MergeFactory(
    new HexGeometry(),
    MergeSettings.of(
      RegionSize.of(size),
      MergeTile.of(2048),
      fourChance === undefined ? undefined : Chance.of(fourChance),
    ),
    seededRandom(1),
  );
}

// The Merge factory creates the whole family of Hexa Merge (issue 99, classes.md decision 31).

describe('MergeFactory', () => {
  // Issue #417: each match draws a new seed, so a replay in one app session gets other tiles.
  it('should_give_other_tiles_when_two_matches_start_with_a_random_source_that_gives_other_draws', () => {
    const factory = factoryWith(new StepRandom([0.1, 0.6]));

    const first = tilesOfMatch(factory);

    expect(tilesOfMatch(factory)).not.toEqual(first);
  });

  // APP-NFR-07: the randomness comes by injection, so a fixed source gives the same game.
  it('should_give_the_same_tiles_twice_when_the_random_source_gives_the_same_draw_each_time', () => {
    const factory = factoryWith(new StepRandom([0.3]));

    const first = tilesOfMatch(factory);

    expect(tilesOfMatch(factory)).toEqual(first);
    expect(tilesOfMatch(factoryWith(new StepRandom([0.3])))).toEqual(first);
  });

  it('should_start_a_game_with_two_tiles_that_plays_one_slide_when_the_merge_factory_builds_it', () => {
    const factory = mergeFactory(7);

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { engine, rules } = startVariant(factory);
    const slide = firstValidMove(rules, mergeStateOf(engine.snapshot()));
    const outcome = playMove(engine, slide);
    const after = engine.snapshot();

    expect(factory.isFor(GameId.of('hexa-merge'))).toBe(true);
    expect(factory.createBoard(BOARD_ID).coordinates()).toHaveLength(7);
    expect(Object.values(values(initial.snapshot()))).toHaveLength(2);
    expect(Object.values(values(initial.snapshot())).every((v) => v === 2 || v === 4)).toBe(true);
    expect(outcome).toBe(Outcome.playing);
    expect(values(after)).not.toEqual(values(initial.snapshot()));
    // The score is the sum of the merged values: the factory picks the Merge scoring.
    expect(after.scoreSoFar()).toEqual(
      Score.of(after.mergedTiles().reduce((sum, tile) => sum + valueOf(tile), 0)),
    );
    expect(after.tileSource().hasNext()).toBe(true);
    expect(engine.takeEvents()).toEqual([]);
  });

  it('should_give_the_same_game_when_two_merge_factories_share_a_seed', () => {
    const play = (seed: number) => {
      const { engine, rules } = startVariant(mergeFactory(seed));
      const start = values(engine.snapshot());
      playMove(engine, firstValidMove(rules, mergeStateOf(engine.snapshot())));
      return [start, values(engine.snapshot())];
    };

    expect(play(9)).toEqual(play(9));
    expect(mergeFactory(9).createPieceSource().take()[0]).toEqual(
      mergeFactory(9).createPieceSource().take()[0],
    );
  });

  // Since issue 210 the chance checks itself, so the error comes when the settings are built.
  // Before, it came when the factory created the piece source.
  it('should_throw_a_range_error_when_the_merge_settings_get_a_chance_of_a_four_that_is_not_a_number', () => {
    const message = 'The chance of a 4 must be a number from 0 to 1, not NaN.';

    expect(() => sizedMergeFactory(2, Number.NaN)).toThrow(new RangeError(message));
  });

  it('should_draw_only_fours_when_the_merge_settings_hold_a_chance_of_one', () => {
    const source = sizedMergeFactory(2, 1).createPieceSource();
    const tiles: MergeTile[] = [];
    for (const draw of source) {
      tiles.push(draw.appearsOn(['any cell'])[1]);
      if (tiles.length === 20) break;
    }

    expect(tiles.every((tile) => tile.equals(MergeTile.of(4)))).toBe(true);
  });

  // Issue #426: the factory gives the target of the settings to the first state.
  // Every new tile is a 2, so the first merge makes a 4, the target.
  it('should_reach_the_target_of_the_settings_when_the_first_merge_of_the_match_makes_it', () => {
    const factory = new MergeFactory(
      new HexGeometry(),
      MergeSettings.of(RegionSize.of(2), MergeTile.of(4), Chance.of(0)),
      seededRandom(5),
    );
    const { engine, rules } = startVariant(factory);
    const before: boolean[] = [];

    while (engine.snapshot().mergedTiles().length === 0 && before.length < 50) {
      before.push(engine.snapshot().hasReachedTarget());
      playMove(engine, firstValidMove(rules, mergeStateOf(engine.snapshot())));
    }

    expect(before.length).toBeGreaterThan(0);
    expect(before.every((reached) => !reached)).toBe(true);
    expect(
      engine
        .snapshot()
        .mergedTiles()
        .every((tile) => tile.equals(MergeTile.of(4))),
    ).toBe(true);
    expect(engine.snapshot().hasReachedTarget()).toBe(true);
  });

  it('should_fill_every_cell_and_stop_when_the_board_has_fewer_cells_than_the_start_tiles', () => {
    // A board with no empty cell gets no new tile, so the rest of the start tiles do not appear.
    const factory = sizedMergeFactory(1);

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);

    expect(factory.createBoard(BOARD_ID).coordinates()).toHaveLength(1);
    expect(Object.keys(values(initial.snapshot()))).toEqual(['0,0']);
    expect([2, 4]).toContain(values(initial.snapshot())['0,0']);
  });
});
