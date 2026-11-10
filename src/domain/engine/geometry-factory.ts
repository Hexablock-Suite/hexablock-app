import type { GridTopology } from './grid-topology';
import type { ShapeNode } from './shape-node';

// The id of one geometry family. A level names its family with this id in `topology` (DS-6).
// It is a value object with a closed set of three instances (classes.md decision 45, issue #207).
// Each value has one shared instance, which is frozen. So `equals()` compares two ids
// by identity, and no code compares a text to know a family.
// A level file keeps the text. `of()` turns a text into its id and refuses an unknown text.
// `toString()` gives the text back, for the error that names a family.
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

  // The text of the id, as a level file holds it.
  toString(): string {
    return this.name;
  }
}

// Abstract Factory (statement §3.3, classes.md decision 17, D11).
// One factory creates the coordinate, the topology and the piece shapes of one geometry.
// `BoardBuilder` and each variant factory receive a factory by composition,
// so no class exists per game and geometry.
// `id` names the family as data, so a caller compares it with `equals()` and reads no concrete class.
// `createCoord()` takes the values of one coordinate and checks them at runtime,
// because a level file has no compile-time types.
// The contract gives a topology with any axis and any direction, because no caller reads them.
export interface GeometryFactory<TCoord> {
  readonly id: TopologyId;
  createCoord(values: number[]): TCoord;
  createTopology(): GridTopology<TCoord>;
  createPieceShapes(): ShapeNode<TCoord>[];
}
