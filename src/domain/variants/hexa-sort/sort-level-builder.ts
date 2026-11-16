import { Color } from '../../engine/color';
import type { GeometryFactory, TopologyId } from '../../engine/geometry-factory';
import type { ILevelBuilder } from '../../engine/level-builder';
import { Moves } from '../../engine/moves';
import { RegionSize } from '../../engine/region-size';
import { Seed } from '../../engine/seed';
import { ColorStack } from './color-stack';
import { GoalCount } from './goal-count';
import { SortLevel } from './sort-level';
import { SortStarThreshold } from './sort-stars';

const NO_SECTION = 'The section of a Sort level needs a radius, goals, a source and stars.';
const NO_ITEM = 'A Sort level needs one item or more in each list.';
const BAD_RADIUS = 'The radius of a Sort level needs a whole number of 1 or more.';
const BAD_GOALS = 'The goals of a Sort level need a number.';
const BAD_SOURCE = 'The source of a Sort level needs a seed and colors, or stacks.';
const BAD_COLOR = 'A color of a Sort level is a text.';
const BAD_STAR = 'A star of a Sort level needs a move count.';

// The fields of one JSON object of a level file, by name.
type Fields = Readonly<Record<string, unknown>>;

// The piece source of a level file, as value objects (A4): a seed with the colors
// that a draw picks from, or the stacks in the order of the file.
type StackSource =
  | { readonly seed: Seed; readonly colors: readonly [Color, ...Color[]] }
  | { readonly stacks: readonly ColorStack[] };

// Concrete Builder (statement §3.3, classes.md decision 15, D9): it builds a `SortLevel`
// step by step from the data of a level file. `LevelDefinition` directs it.
// The builder holds the `GeometryFactory` that it receives (classes.md decision 17).
// `withTopology()` refuses a topology of another family, because the topology of the level
// says which board the radius gives.
// `withSection()` adds the radius, the goals, the source and the stars of the section.
// It checks each field that it reads at runtime, because a level file has no compile-time types.
// It turns each number of the file into its value object, so no number reaches the level.
// A value that it refuses goes into the error as its `cause` (issue #237).
// `build()` creates the level through `SortLevel.seeded()` or `SortLevel.fixed()`, so the level
// checks its own data (classes.md decision 47). Then `withStars()` gives it its thresholds.
// The builder never reads a file (classes.md decision 24).
export class SortLevelBuilder<TCoord> implements ILevelBuilder<SortLevel> {
  private topology: TopologyId | undefined;
  private size: RegionSize | undefined;
  private goalsNeeded: GoalCount | undefined;
  private source: StackSource | undefined;
  private stars: readonly SortStarThreshold[] | undefined;

  constructor(private readonly geometry: GeometryFactory<TCoord>) {}

  // The error carries the topology and the geometry as its `cause`.
  withTopology(topology: TopologyId): SortLevelBuilder<TCoord> {
    if (!this.geometry.isOfFamily(topology)) {
      throw new RangeError('A Sort level builder cannot build the board of another topology.', {
        cause: { topology, geometry: this.geometry },
      });
    }
    this.topology = topology;
    return this;
  }

  withSection(section: unknown): SortLevelBuilder<TCoord> {
    const { radius, goals, source, stars } = fieldsOf(
      section,
      ['radius', 'goals', 'source', 'stars'],
      NO_SECTION,
    );
    return this.withRadius(radius).withGoals(goals).withSource(source).withStars(stars);
  }

  // A builder with no topology or no section throws a RangeError.
  build(): SortLevel {
    const { topology, size, goalsNeeded, source, stars } = this;
    if (
      topology === undefined ||
      size === undefined ||
      goalsNeeded === undefined ||
      source === undefined ||
      stars === undefined
    ) {
      throw new RangeError('A Sort level builder needs a topology and a section.');
    }
    const level =
      'stacks' in source
        ? SortLevel.fixed(size, goalsNeeded, source.stacks)
        : SortLevel.seeded(size, goalsNeeded, source.seed, source.colors);
    return level.withStars(stars);
  }

  // The board holds every cell at distance `radius` or less from its center (DS-6).
  // `HexTopology.region()` holds the cells at distance size - 1 or less, so the size is
  // the radius plus 1, and the radius 2 gives 19 cells. The square and the triangle regions
  // of the engine grow from a corner, so there the size gives the length of each side.
  private withRadius(radius: unknown): SortLevelBuilder<TCoord> {
    if (typeof radius !== 'number' || !Number.isSafeInteger(radius) || radius < 1) {
      throw new RangeError(BAD_RADIUS, { cause: radius });
    }
    this.size = RegionSize.of(radius + 1);
    return this;
  }

  // The goals are the count of stacks that the player clears to win.
  private withGoals(goals: unknown): SortLevelBuilder<TCoord> {
    if (typeof goals !== 'number') throw new RangeError(BAD_GOALS, { cause: goals });
    this.goalsNeeded = GoalCount.of(goals);
    return this;
  }

  // A level picks one kind of source (A4): a seed with its colors, or a list of stacks.
  // Each stack lists its colors from the bottom tile to the top tile.
  // A source of both kinds, or of no kind, throws a RangeError.
  private withSource(source: unknown): SortLevelBuilder<TCoord> {
    const { seed, colors, stacks } = fieldsOf(source, [], BAD_SOURCE);
    if (stacks !== undefined && seed === undefined && colors === undefined) {
      this.source = { stacks: listOf(stacks, (each) => ColorStack.of(listOf(each, colorOf))) };
    } else if (stacks === undefined && typeof seed === 'number' && colors !== undefined) {
      this.source = { seed: Seed.of(seed), colors: listOf(colors, colorOf) };
    } else {
      throw new RangeError(BAD_SOURCE, { cause: source });
    }
    return this;
  }

  // Each threshold holds a move count, from the first star up.
  private withStars(stars: unknown): SortLevelBuilder<TCoord> {
    this.stars = listOf(stars, (threshold) => {
      const { maxMoves } = fieldsOf(threshold, ['maxMoves'], BAD_STAR);
      if (typeof maxMoves !== 'number') throw new RangeError(BAD_STAR, { cause: threshold });
      return SortStarThreshold.of(Moves.of(maxMoves));
    });
    return this;
  }
}

// The color that a name of the file names. `Color.of()` refuses a blank name.
function colorOf(name: unknown): Color {
  if (typeof name !== 'string') throw new RangeError(BAD_COLOR, { cause: name });
  return Color.of(name);
}

// The fields of a JSON object that holds every field of `names`.
// Any other value throws a RangeError with `message`, and the value is its `cause`.
function fieldsOf(value: unknown, names: readonly string[], message: string): Fields {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !names.every((name) => name in value)
  ) {
    throw new RangeError(message, { cause: value });
  }
  return value as Fields;
}

// The items of a JSON list of one item or more, each one turned by `item`.
// Any other value throws a RangeError with the value as `cause`.
function listOf<T>(value: unknown, item: (each: unknown) => T): readonly [T, ...T[]] {
  if (!Array.isArray(value) || value.length === 0) throw new RangeError(NO_ITEM, { cause: value });
  const [first, ...rest]: unknown[] = value;
  return [item(first), ...rest.map((each) => item(each))];
}
