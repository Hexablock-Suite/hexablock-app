import type { Ordered } from './ordered';
import type { ValueReceiver } from '../../shared/value-receiver';

// The key of one coordinate: the identity that a topology gives in `key()` (issue #237).
// The coordinate builds its key, and the topology gives it to the engine.
// A branded text counts as a primitive (decision of 2026-11-16, issue #246).
// So the key is a value object of the engine: it never changes, and its text is private.
// The engine compares two keys with `equals()` and orders them with `isBefore()`.
// A `Map` and a `Set` compare an object by reference, so the engine keys a value
// with `CoordKeyMap`, which compares by value (classes.md decision 44).
// Only an adapter of the edge receives the text, through `deliverTo(receiver)`.
export class CoordKey implements Ordered<CoordKey> {
  private constructor(private readonly text: string) {
    Object.freeze(this);
  }

  // Makes the key of a coordinate. A coordinate calls it in its own `key()`.
  // It takes any text and checks no format. The coordinate class of each topology owns
  // the format of its keys. The topology must give one key to each coordinate
  // and two keys to two coordinates.
  // This is a design choice: the engine cannot know the format of every topology.
  static of(text: string): CoordKey {
    return new CoordKey(text);
  }

  // True when two lists hold equal keys, each key as many times, in any order.
  static sameKeys(left: readonly CoordKey[], right: readonly CoordKey[]): boolean {
    if (left.length !== right.length) return false;
    const rest = [...right];
    return left.every((key) => {
      const at = rest.findIndex((other) => key.equals(other));
      if (at < 0) return false;
      rest.splice(at, 1);
      return true;
    });
  }

  // Two keys are equal when they hold the same text.
  equals(other: CoordKey): boolean {
    return this.text === other.text;
  }

  // Tells if this key comes before the other key. The texts compare by plain string order
  // (code units, `<`), not by `localeCompare`, so the order is the same on every device.
  isBefore(other: CoordKey): boolean {
    return this.text < other.text;
  }

  // Gives the text to a receiver of the edge (rule R-no-delivery-call).
  deliverTo(receiver: ValueReceiver<string>): void {
    receiver.receive(this.text);
  }
}
