import type { Color } from '../../engine/color';
import { Mulberry32Random } from '../../engine/mulberry32-random';
import { FixedListPieceSource } from '../../engine/piece-source';
import type { RandomSource } from '../../engine/random-source';
import type { RegionSize } from '../../engine/region-size';
import { ColorStack } from './color-stack';
import type { GoalCount } from './goal-count';

// The data of the piece source of a level. A level picks one of the two kinds (A4).
// A seeded supply holds the seed and the colors that a draw picks from.
// A fixed supply holds the stacks in the order of the level.
type StackSupply =
  | { readonly seed: number; readonly colors: readonly Color[] }
  | { readonly stacks: readonly ColorStack[] };

// What `sourceWith()` asks of its caller: one builder for each kind of supply.
// `draw` turns a random source into one stack of the level.
export interface SortSourceBuilders<TSource> {
  seeded(seed: number, draw: (random: RandomSource) => ColorStack): TSource;
  fixed(stacks: readonly ColorStack[]): TSource;
}

// One Hexa Sort level: the size of the board region, its goal and the data of its piece source.
// It is a value object (classes.md decision 47, issue #209): it never changes,
// its fields are private, and two levels are equal when their parts are equal.
// The level holds data only: the seed, or the fixed list of stacks. It holds no `IPieceSource`.
// `SortFactory` builds a new source from that data for each game.
// The goal is a `GoalCount`, so a level cannot ask for 0 goals (issue #129).
// The level guards its own invariant. Each factory method makes every check of its data,
// so a level with a wrong seed cannot exist.
// Each factory method copies its list and freezes the copy, and the object is frozen.
// So a change to the array of the caller does not change the level.
// The seed is a number until issue #210 turns it into a `Seed`.
// `SortLevelBuilder` builds the level through a factory method in Sprint 3 (#167).
export class SortLevel {
  private constructor(
    private readonly size: RegionSize,
    private readonly goalsNeeded: GoalCount,
    private readonly supply: StackSupply,
  ) {
    Object.freeze(this);
  }

  // A level whose source draws stacks at random from `seed`, and never ends.
  // The seed is a whole number from 0 to 4294967295. Any other number throws a RangeError.
  // `Mulberry32Random` holds that check, so the level and the seeded source refuse the same seeds.
  // `FixedListPieceSource` holds the check of `undefined`, so the level reads its copy.
  // A list with no color throws a RangeError, because a draw needs a color to pick.
  static seeded(
    size: RegionSize,
    goalsNeeded: GoalCount,
    seed: number,
    colors: readonly [Color, ...Color[]],
  ): SortLevel {
    new Mulberry32Random(seed);
    const copy = [...new FixedListPieceSource<Color>(colors)];
    if (copy.length === 0) throw new RangeError('A seeded Sort level needs one color or more.');
    return new SortLevel(size, goalsNeeded, Object.freeze({ seed, colors: Object.freeze(copy) }));
  }

  // A level whose source gives `stacks` in their order, and then ends.
  // A list that holds `undefined` throws a RangeError, with the message of `FixedListPieceSource`.
  static fixed(size: RegionSize, goalsNeeded: GoalCount, stacks: readonly ColorStack[]): SortLevel {
    const copy = [...new FixedListPieceSource(stacks)];
    return new SortLevel(size, goalsNeeded, Object.freeze({ stacks: Object.freeze(copy) }));
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
  // A seeded level gives its seed and its draw. Each draw reads one number
  // and gives a stack of one tile, of the color that the number picks.
  // A fixed level gives its frozen list of stacks.
  sourceWith<TSource>(builders: SortSourceBuilders<TSource>): TSource {
    const supply = this.supply;
    if ('stacks' in supply) return builders.fixed(supply.stacks);
    const { colors } = supply;
    return builders.seeded(supply.seed, (random) => {
      const color = colors[Math.floor(random.next() * colors.length)] ?? (colors[0] as Color);
      return ColorStack.of([color]);
    });
  }

  // Two levels are equal when they hold the same size, the same goal and equal source data.
  // Two seeded levels need the same seed and equal colors in the same order,
  // because a draw picks a color by its place in the list.
  // Two fixed levels need equal stacks in the same order, because the source keeps that order.
  // A seeded level and a fixed level are never equal.
  equals(other: SortLevel): boolean {
    return (
      this.size.equals(other.size) &&
      this.goalsNeeded.equals(other.goalsNeeded) &&
      sameSupply(this.supply, other.supply)
    );
  }
}

// True when both supplies are of one kind and hold equal data in the same order.
function sameSupply(left: StackSupply, right: StackSupply): boolean {
  if ('stacks' in left) {
    return (
      'stacks' in right &&
      left.stacks.length === right.stacks.length &&
      left.stacks.every((stack, i) => right.stacks[i]?.equals(stack) === true)
    );
  }
  return (
    !('stacks' in right) &&
    left.seed === right.seed &&
    left.colors.length === right.colors.length &&
    left.colors.every((color, i) => right.colors[i]?.equals(color) === true)
  );
}
