import { TopologyId } from '../shared/topology-id';
import type { ILevelBuilder } from './level-builder';
import { LevelId } from './level-id';

// The data of one level file in the shared level format (DS-6, issues #166 and #168).
// An adapter of an outer layer reads the file and creates the definition with `of()`
// (classes.md decision 24). The definition lives in layer 1, so a level builder can read it.
// Layer 2 names it too, because a repository port returns it.
// It is a value object: it never changes, and two definitions are equal when their data is equal.
// The text and the numbers of the file stay in the parameter of `of()` and in private fields
// (APP-NFR-25).
// `of()` turns the level id into a `LevelId` and the topology into a `TopologyId`.
// Each one refuses a wrong text. `of()` also refuses an order that is not a whole number of 1 or more.
// The definition keeps the section as JSON text. Each build parses a new copy,
// so neither the caller nor a builder can change the section of the definition.
// A builder reads the topology and the section. The list of levels reads the level id,
// the order and the topology (#168). It reads no `version`: DS-11 compares two copies later.
export class LevelDefinition {
  private constructor(
    private readonly id: LevelId,
    private readonly order: number,
    private readonly topology: TopologyId,
    private readonly section: string,
  ) {
    Object.freeze(this);
  }

  // A file with no section throws a RangeError. Only a cast or a broken file leaves it out.
  // An order that is not a whole number of 1 or more throws a RangeError,
  // and the error carries the order as its `cause` (issue #237).
  static of(level: {
    levelId: string;
    order: number;
    topology: string;
    section: unknown;
  }): LevelDefinition {
    const section = JSON.stringify(level.section) as string | undefined;
    if (section === undefined) throw new RangeError('A level file needs a section.');
    if (!Number.isSafeInteger(level.order) || level.order < 1) {
      throw new RangeError('A level order needs a whole number of 1 or more.', {
        cause: level.order,
      });
    }
    return new LevelDefinition(
      LevelId.of(level.levelId),
      level.order,
      TopologyId.of(level.topology),
      section,
    );
  }

  // Director of the Builder pattern (classes.md decision 15): the definition gives the builder
  // its topology, then a new copy of its section, and then it asks the builder for the level.
  buildWith<TLevel>(builder: ILevelBuilder<TLevel>): TLevel {
    return builder.withTopology(this.topology).withSection(JSON.parse(this.section)).build();
  }

  // The id of the level. The list of levels names each level with it, and the progress
  // keeps the result of a level under it (#168). A `LevelId` never changes.
  levelId(): LevelId {
    return this.id;
  }

  // Tells if the level is played on the figure `figure`: its topology names that figure
  // (S3-08 in #151). A level builder refuses a level of another figure.
  isPlayedOn(figure: TopologyId): boolean {
    return this.topology.equals(figure);
  }

  // Tells if this level comes before `other` in the list of its game, by the `order` of the file
  // (S3-12 in #151). A level of an equal order does not come before.
  comesBefore(other: LevelDefinition): boolean {
    return this.order < other.order;
  }

  // Two definitions are equal when they hold the same level id, order, topology and section text.
  equals(other: LevelDefinition): boolean {
    return (
      this.id.equals(other.id) &&
      this.order === other.order &&
      this.topology.equals(other.topology) &&
      this.section === other.section
    );
  }
}
