import type { Color } from '../../engine/color';
import type { IStarsByMoves } from '../../progress/level-progress';
import type { Moves } from '../../shared/moves';
import { frozenListOf } from '../../engine/frozen-list';
import type { RandomSource } from '../../engine/random-source';
import type { RegionSize } from '../../engine/region-size';
import type { Seed } from '../../engine/seed';
import { starsOf } from '../../progress/star-count';
import type { Stars } from '../../progress/stars';
import { ColorStack } from './color-stack';
import type { GoalCount } from './goal-count';
import { SortPlay, type SortStarThreshold } from './sort-stars';

// The data of the piece source of a level. A level picks one of three kinds (A4).
// A seeded supply holds the seed and the colors that a draw picks from.
// A supply seeded each match holds only the colors: the factory draws a new seed for each match
// (issue #417).
// A fixed supply holds the stacks in the order of the level.
type SeededSupply =
  | { readonly seed: Seed; readonly colors: readonly Color[] }
  | { readonly colors: readonly Color[] };
type StackSupply = SeededSupply | { readonly stacks: readonly ColorStack[] };

// What `sourceWith()` asks of its caller: one builder for each kind of supply.
// `draw` turns a random source into one stack of the level.
// `seededEachMatch` takes no seed: the builder draws a new seed for each match (issue #417).
export interface SortSourceBuilders<TSource> {
  seeded(seed: Seed, draw: (random: RandomSource) => ColorStack): TSource;
  seededEachMatch(draw: (random: RandomSource) => ColorStack): TSource;
  fixed(stacks: readonly ColorStack[]): TSource;
}

// One Hexa Sort level: the size of the board region, its goal and the data of its piece source.
// It is a value object (classes.md decision 47, issue #209): it never changes,
// its fields are private, and two levels are equal when their parts are equal.
// The level holds data only: the seed and the colors, the colors alone, or the fixed list
// of stacks. It holds no `IPieceSource`.
// `SortFactory` builds a new source from that data for each game.
// The goal is a `GoalCount`, so a level cannot ask for 0 goals (issue #129).
// The level guards its own invariant. Each factory method makes every check of its data.
// The seed is a `Seed`, which checks its own range (classes.md decision 48, issue #210),
// so a level with a wrong seed cannot exist.
// Each factory method copies its list with `frozenListOf()`, and the object is frozen.
// So a change to the array of the caller does not change the level.
// `SortLevelBuilder` builds the level from a level file through a factory method (#167).
// The level also holds the thresholds of its stars, and `LevelProgress` asks it for the stars
// of a play through `IStarsByMoves` (issues #156 and #424). A level holds no threshold until
// `withStars()` gives them. `SortLevelBuilder` gives it the thresholds of the file.
export class SortLevel implements IStarsByMoves {
  private constructor(
    private readonly size: RegionSize,
    private readonly goalsNeeded: GoalCount,
    private readonly supply: StackSupply,
    private readonly stars: readonly SortStarThreshold[] = Object.freeze([]),
  ) {
    Object.freeze(this);
  }

  // A level whose source draws stacks at random from `seed`, and never ends.
  // A level file names its seed, so each match of the level draws the same stacks (A4).
  static seeded(
    size: RegionSize,
    goalsNeeded: GoalCount,
    seed: Seed,
    colors: readonly [Color, ...Color[]],
  ): SortLevel {
    return new SortLevel(size, goalsNeeded, Object.freeze({ seed, colors: colorsOf(colors) }));
  }

  // A level whose source draws stacks at random from a new seed in each match, and never ends.
  // The default Sort game of the first content takes it (issue #417).
  static seededEachMatch(
    size: RegionSize,
    goalsNeeded: GoalCount,
    colors: readonly [Color, ...Color[]],
  ): SortLevel {
    return new SortLevel(size, goalsNeeded, Object.freeze({ colors: colorsOf(colors) }));
  }

  // A level whose source gives `stacks` in their order, and then ends.
  // `frozenListOf()` copies the stacks and refuses `undefined`.
  static fixed(size: RegionSize, goalsNeeded: GoalCount, stacks: readonly ColorStack[]): SortLevel {
    return new SortLevel(size, goalsNeeded, Object.freeze({ stacks: frozenListOf(stacks) }));
  }

  // The size of the board region of the level.
  boardSize(): RegionSize {
    return this.size;
  }

  // The count of stacks that the player clears to win the level.
  goal(): GoalCount {
    return this.goalsNeeded;
  }

  // Gives the data of the piece source to the builder of its kind, and returns what it builds.
  // So the caller builds the source and asks no question about the kind.
  // A seeded level gives its seed and its draw, and a level seeded each match gives its draw only.
  // Each draw reads one number and gives a stack of one tile, of the color that the number picks.
  // A fixed level gives its frozen list of stacks.
  sourceWith<TSource>(builders: SortSourceBuilders<TSource>): TSource {
    const supply = this.supply;
    if ('stacks' in supply) return builders.fixed(supply.stacks);
    const { colors } = supply;
    const draw = (random: RandomSource) => ColorStack.of([random.next().pick(colors)]);
    if ('seed' in supply) return builders.seeded(supply.seed, draw);
    return builders.seededEachMatch(draw);
  }

  // The same level with the star thresholds `stars`, from the first star up (D22).
  // It copies the list and freezes the copy, so a change to the array of the caller
  // does not change the level. This level does not change.
  withStars(stars: readonly SortStarThreshold[]): SortLevel {
    return new SortLevel(this.size, this.goalsNeeded, this.supply, Object.freeze([...stars]));
  }

  // The stars of a won play of this level: `starsOf()` counts the leading thresholds
  // that the moves of the play meet (D22, classes.md decision 36).
  // A Sort level has no timer, so it takes no time (issue #424).
  starsFor(moves: Moves): Stars {
    return starsOf(SortPlay.of(moves), this.stars);
  }

  // Two levels are equal when they hold the same size, the same goal, equal source data
  // and equal star thresholds in the same order.
  // Two seeded levels need the same seed and equal colors in the same order,
  // because a draw picks a color by its place in the list.
  // Two levels seeded each match need equal colors in the same order.
  // Two fixed levels need equal stacks in the same order, because the source keeps that order.
  // Two levels of two kinds are never equal.
  equals(other: SortLevel): boolean {
    return (
      this.size.equals(other.size) &&
      this.goalsNeeded.equals(other.goalsNeeded) &&
      sameSupply(this.supply, other.supply) &&
      this.stars.length === other.stars.length &&
      this.stars.every((threshold, i) => other.stars[i]?.equals(threshold) === true)
    );
  }
}

// The colors of a seeded level: a frozen copy of one color or more.
// `frozenListOf()` copies the colors and refuses `undefined`.
// A list with no color throws a RangeError, because a draw needs a color to pick.
function colorsOf(colors: readonly Color[]): readonly Color[] {
  const copy = frozenListOf(colors);
  if (copy.length === 0) throw new RangeError('A seeded Sort level needs one color or more.');
  return copy;
}

// True when both supplies are of one kind and hold equal data in the same order.
function sameSupply(left: StackSupply, right: StackSupply): boolean {
  if ('stacks' in left || 'stacks' in right) {
    return (
      'stacks' in left &&
      'stacks' in right &&
      left.stacks.length === right.stacks.length &&
      left.stacks.every((stack, i) => right.stacks[i]?.equals(stack) === true)
    );
  }
  return (
    sameSeed(left, right) &&
    left.colors.length === right.colors.length &&
    left.colors.every((color, i) => right.colors[i]?.equals(color) === true)
  );
}

// True when both supplies hold equal seeds, or when neither one holds a seed.
function sameSeed(left: SeededSupply, right: SeededSupply): boolean {
  if ('seed' in left) return 'seed' in right && left.seed.equals(right.seed);
  return !('seed' in right);
}
