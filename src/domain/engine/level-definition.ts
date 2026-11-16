import { TopologyId } from './geometry-factory';
import type { ILevelBuilder } from './level-builder';

// The data of one level file in the shared level format (DS-6, issue #166).
// An adapter of an outer layer reads the file and creates the definition with `of()`
// (classes.md decision 24). The definition lives in layer 1, so a level builder can read it.
// Layer 2 names it too, because a repository port returns it.
// It is a value object: it never changes, and two definitions are equal when their data is equal.
// The text of the file stays in the parameter of `of()` and in private fields (APP-NFR-25).
// `of()` turns the topology into a `TopologyId`, which refuses an unknown text.
// The definition keeps the section as JSON text. Each build parses a new copy,
// so neither the caller nor a builder can change the section of the definition.
// The definition holds the topology and the section, the two parts that a builder reads.
// The list of levels reads the other fields of the common part (#168).
export class LevelDefinition {
  private constructor(
    private readonly topology: TopologyId,
    private readonly section: string,
  ) {
    Object.freeze(this);
  }

  // A file with no section throws a RangeError. Only a cast or a broken file leaves it out.
  static of(level: { topology: string; section: unknown }): LevelDefinition {
    const section = JSON.stringify(level.section) as string | undefined;
    if (section === undefined) throw new RangeError('A level file needs a section.');
    return new LevelDefinition(TopologyId.of(level.topology), section);
  }

  // Director of the Builder pattern (classes.md decision 15): the definition gives the builder
  // its topology, then a new copy of its section, and then it asks the builder for the level.
  buildWith<TLevel>(builder: ILevelBuilder<TLevel>): TLevel {
    return builder.withTopology(this.topology).withSection(JSON.parse(this.section)).build();
  }

  // Two definitions are equal when they name the same topology and hold the same section text.
  equals(other: LevelDefinition): boolean {
    return this.topology.equals(other.topology) && this.section === other.section;
  }
}
