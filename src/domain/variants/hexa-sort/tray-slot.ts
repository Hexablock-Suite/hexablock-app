// The place of one stack in the Hexa Sort tray, from 0 (issue #353).
// A `PlaceStack` names the stack that it places with it (classes.md decision 43).
// It is a value object: it never changes, and two slots are equal when their indexes are equal.
// A slot index is a safe integer of 0 or more. Any other number throws a RangeError,
// so the rules and the state never check the index again. A negative zero is stored as 0.
// The object is frozen, so no caller writes the index.
// The index is private, and no operation returns it. The slot finds its stack in a tray,
// and it builds the error that names its index.
export class TraySlot {
  private constructor(private readonly index: number) {
    Object.freeze(this);
  }

  static of(index: number): TraySlot {
    if (!Number.isSafeInteger(index) || index < 0) {
      throw new RangeError(`A tray slot needs a whole number of 0 or more, not ${index}.`);
    }
    return new TraySlot(index === 0 ? 0 : index);
  }

  // Two slots are equal when they hold the same index.
  equals(other: TraySlot): boolean {
    return this.index === other.index;
  }

  // The stack of the tray at this slot, or `undefined` when the slot is empty
  // or the tray has no slot there.
  stackIn<TStack>(tray: readonly (TStack | undefined)[]): TStack | undefined {
    return tray[this.index];
  }

  // The tray with this slot empty. The other slots keep their stacks, and the tray does not change.
  emptiedIn<TStack>(tray: readonly (TStack | undefined)[]): (TStack | undefined)[] {
    return tray.map((stack, index) => (index === this.index ? undefined : stack));
  }

  // The error of a tray that holds no stack at this slot.
  emptySlot(): RangeError {
    return new RangeError(`The tray holds no stack at slot ${this.index}.`);
  }
}
