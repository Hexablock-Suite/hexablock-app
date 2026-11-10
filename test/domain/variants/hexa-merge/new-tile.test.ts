/** @jest-environment node */
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import { NewTile } from '../../../../src/domain/variants/hexa-merge/new-tile';

// One draw of the Merge tile source is a value object (issue 210, classes.md decision 48).
// It holds the tile and the place of its cell, and both fields are private.

const two = MergeTile.of(2);
const four = MergeTile.of(4);

describe('NewTile', () => {
  it('should_throw_a_range_error_when_the_place_is_not_a_number_from_0_up_to_1', () => {
    const bad = [-0.1, 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY];
    for (const place of bad) {
      expect(() => NewTile.of(place, two)).toThrow(
        new RangeError(`The place of a new tile must be a number from 0 up to 1, not ${place}.`),
      );
    }
  });

  it('should_give_the_empty_cell_that_the_place_picks_and_the_tile_when_the_tile_appears', () => {
    const empty = ['a', 'b', 'c', 'd'];

    expect(NewTile.of(0, four).appearsOn(empty)).toEqual(['a', four]);
    expect(NewTile.of(0.25, two).appearsOn(empty)).toEqual(['b', two]);
    expect(NewTile.of(0.999, two).appearsOn(empty)).toEqual(['d', two]);
    expect(NewTile.of(0.999, two).appearsOn(['only'])).toEqual(['only', two]);
    expect(NewTile.of(0, four).appearsOn(empty)[1]).toBe(four);
  });

  it('should_throw_a_range_error_when_the_tile_appears_on_no_empty_cell', () => {
    expect(() => NewTile.of(0, two).appearsOn([])).toThrow(
      new RangeError('A new tile needs one empty cell or more.'),
    );
  });

  it('should_be_equal_when_two_new_tiles_hold_the_same_place_and_equal_tiles', () => {
    const tile = NewTile.of(0.5, two);

    expect(tile).not.toBe(NewTile.of(0.5, MergeTile.of(2)));
    expect(tile.equals(NewTile.of(0.5, MergeTile.of(2)))).toBe(true);
    expect(NewTile.of(0.5, MergeTile.of(2)).equals(tile)).toBe(true);
    expect(tile.equals(NewTile.of(0.25, two))).toBe(false);
    expect(tile.equals(NewTile.of(0.5, four))).toBe(false);
  });

  it('should_refuse_a_write_when_a_caller_changes_the_new_tile', () => {
    const tile = NewTile.of(0.5, two);

    expect(Object.isFrozen(tile)).toBe(true);
    expect(Reflect.set(tile, 'place', 0)).toBe(false);
    expect(Reflect.set(tile, 'tile', four)).toBe(false);
    expect(tile.equals(NewTile.of(0.5, two))).toBe(true);
  });
});
