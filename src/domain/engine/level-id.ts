import type { ValueReceiver } from './value-receiver';

// The id of one level of a game, such as `fit-01` (classes.md decision 42, issue #204).
// The level file gives it. A game with no levels has no level id.
// It is a value object: it never changes, and two ids are equal when their texts are equal.
// The id keeps its text as it arrives, as the backend `LevelId` does (hexablock-api#88).
// An empty id, or an id of only spaces, throws a RangeError.
// The object is frozen, so no caller writes the value.
// The value is private (issue #228). `deliverTo()` gives the text to a receiver,
// and no operation returns it. Only an adapter of the edge calls `deliverTo()`:
// the domain and the use cases call `equals()`.
export class LevelId {
  private constructor(private readonly value: string) {
    Object.freeze(this);
  }

  static of(value: string): LevelId {
    if (value.trim() === '') throw new RangeError('A level id cannot be empty.');
    return new LevelId(value);
  }

  // Two level ids are equal when they hold the same text.
  equals(other: LevelId): boolean {
    return this.value === other.value;
  }

  // Gives the text of this level id to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<string>): void {
    receiver.receive(this.value);
  }
}
