import type { ValueReceiver } from './value-receiver';

// The id of one geometry family. A level names its family with this id in `topology` (DS-6).
// It is a value object with a closed set of three instances (classes.md decision 45, issue #207).
// Each value has one shared instance, which is frozen. So `equals()` compares two ids
// by identity, and no code compares a text to know a family.
// A level file keeps the text. `of()` turns a text into its id and refuses an unknown text.
// The text is private (issue #237). `deliverTo()` gives it to a receiver, and no operation
// returns it. An error that names a family carries the id as its `cause`.
export class TopologyId {
  static readonly hex = new TopologyId('hex');
  static readonly square = new TopologyId('square');
  static readonly triangle = new TopologyId('triangle');

  // The closed set by its texts. A `Map` has no inherited keys,
  // so a text such as `constructor` names no family.
  private static readonly byName: ReadonlyMap<string, TopologyId> = new Map(
    [TopologyId.hex, TopologyId.square, TopologyId.triangle].map((id) => [id.name, id]),
  );

  private constructor(private readonly name: string) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (TopologyId.byName !== undefined) throw new RangeError('The set of topologies is closed.');
    Object.freeze(this);
  }

  // The id that a text names. An unknown text throws a RangeError.
  static of(name: string): TopologyId {
    const found = TopologyId.byName.get(name);
    if (found === undefined) throw new RangeError(`Unknown topology: ${name}.`);
    return found;
  }

  // Two ids are equal when they are the same instance.
  equals(other: TopologyId): boolean {
    return this === other;
  }

  // Gives the text of the id, as a level file holds it, to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<string>): void {
    receiver.receive(this.name);
  }
}
