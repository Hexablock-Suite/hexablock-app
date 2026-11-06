/** @jest-environment node */
import { firstValidMove, startVariant } from '../../../support/engine/variant-game';
import { mergeFactory, values } from '../../../support/variants/hexa-merge/merge-game';

// The Merge factory creates the whole family of Hexa Merge (issue 99, classes.md decision 31).

describe('MergeFactory', () => {
  it('should_start_a_game_with_two_tiles_that_plays_one_slide_when_the_merge_factory_builds_it', () => {
    const factory = mergeFactory(7);

    const initial = factory.createInitialState();
    const { engine, rules, publisher } = startVariant(factory);
    const slide = firstValidMove(rules, engine.snapshot());
    const outcome = engine.play(slide);
    const after = engine.snapshot();

    expect(factory.gameId.value).toBe('hexa-merge');
    expect(factory.createBoard().shape.cells).toHaveLength(7);
    expect(Object.values(values(initial))).toHaveLength(2);
    expect(Object.values(values(initial)).every((v) => v === 2 || v === 4)).toBe(true);
    expect(outcome).toBe('playing');
    expect(values(after)).not.toEqual(values(initial));
    // The score is the sum of the merged values: the factory picks the Merge scoring.
    expect(after.score).toBe(after.merged.reduce((sum, tile) => sum + tile.value, 0));
    expect(after.tiles.hasNext()).toBe(true);
    expect(publisher.events).toEqual([]);
  });

  it('should_give_the_same_game_when_two_merge_factories_share_a_seed', () => {
    const play = (seed: number) => {
      const { engine, rules } = startVariant(mergeFactory(seed));
      const start = values(engine.snapshot());
      engine.play(firstValidMove(rules, engine.snapshot()));
      return [start, values(engine.snapshot())];
    };

    expect(play(9)).toEqual(play(9));
    expect(mergeFactory(9).createPieceSource().next()).toEqual(
      mergeFactory(9).createPieceSource().next(),
    );
  });
});
