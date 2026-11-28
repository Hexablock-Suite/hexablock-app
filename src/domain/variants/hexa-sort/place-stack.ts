import type { CoordKey } from '../../engine/geometry/coord-key';
import type { TraySlot } from './tray-slot';

// The move of Hexa Sort: place the stack of the tray slot `slot` on the cell `at`
// (statement §1.3, issue #353). It is a value object (classes.md decision 43): it never changes,
// its fields are private, and two moves are equal when they name the same slot and the same cell.
// The slot is a `TraySlot`, which checks its own index.
// A move does not know the tray or the board. The state asks the move for its stack
// and checks that the cell is inside the board and free.
export class PlaceStack<TCoord> {
  private constructor(
    private readonly slot: TraySlot,
    private readonly at: TCoord,
  ) {}

  static on<TCoord>(slot: TraySlot, at: TCoord): PlaceStack<TCoord> {
    return new PlaceStack(slot, at);
  }

  // The cell that takes the stack.
  cell(): TCoord {
    return this.at;
  }

  // The stack of the tray that this move places, or `undefined` when its slot is empty.
  stackIn<TStack>(tray: readonly (TStack | undefined)[]): TStack | undefined {
    return this.slot.stackIn(tray);
  }

  // The tray with the slot of this move empty. The tray does not change.
  trayWithout<TStack>(tray: readonly (TStack | undefined)[]): (TStack | undefined)[] {
    return this.slot.emptiedIn(tray);
  }

  // The error of a tray that holds no stack at the slot of this move.
  emptySlot(): RangeError {
    return this.slot.emptySlot();
  }

  // Two moves are equal when they name the same slot and the same cell.
  // The topology compares the cells, because `TCoord` has no bound (classes.md decision 16).
  equals(other: PlaceStack<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return this.slot.equals(other.slot) && topology.key(this.at).equals(topology.key(other.at));
  }
}
