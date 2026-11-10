import { Range } from '../../engine/range';
import type { IMergeable } from './mergeable';

// The places that a draw can take: from 0 up to 1. The check of `of()` leaves 1 out.
const PLACES = Range.ofNumbers(0, 1);

// One draw of the Merge tile source: the tile that appears after a slide, and where.
// It is a value object (classes.md decision 48, issue #210): it never changes,
// its fields are private, and two draws are equal when their parts are equal.
// `place` is a number from 0 up to 1, as a random source gives it. Any other number
// throws a RangeError. `appearsOn()` turns it into one of the empty cells,
// so the cell and the value both come from the same seeded source (APP-NFR-07).
// The bound `IMergeable` gives `equals()` its comparison of two tiles.
export class NewTile<TCell extends IMergeable<TCell>> {
  private constructor(
    private readonly place: number,
    private readonly tile: TCell,
  ) {
    Object.freeze(this);
  }

  static of<TCell extends IMergeable<TCell>>(place: number, tile: TCell): NewTile<TCell> {
    if (!PLACES.contains(place) || place === 1) {
      throw new RangeError(
        `The place of a new tile must be a number from 0 up to 1, not ${place}.`,
      );
    }
    return new NewTile(place, tile);
  }

  // The empty cell that the draw picks, and the tile that appears on it.
  // The place picks the cell by its position in `empty`, so the order of the list counts.
  // A list with no cell throws a RangeError, because the tile has no place to appear.
  appearsOn<TCoord>(empty: readonly TCoord[]): [TCoord, TCell] {
    if (empty.length === 0) throw new RangeError('A new tile needs one empty cell or more.');
    return [empty[Math.floor(this.place * empty.length)] as TCoord, this.tile];
  }

  // Two draws are equal when they hold the same place and equal tiles.
  // `canMergeWith()` is true exactly for two equal tiles (§1.4).
  equals(other: NewTile<TCell>): boolean {
    return this.place === other.place && this.tile.canMergeWith(other.tile);
  }
}
