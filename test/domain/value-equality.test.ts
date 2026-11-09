/** @jest-environment node */
import { BoardShape } from '../../src/domain/engine/board-shape';
import { Color } from '../../src/domain/engine/color';
import { GameId } from '../../src/domain/engine/game-id';
import { Piece } from '../../src/domain/engine/piece';
import { GameResult, ProgressRecord } from '../../src/domain/engine/progress-model';
import { Radius } from '../../src/domain/engine/radius';
import { Range, type Compare } from '../../src/domain/engine/range';
import { RegionSize } from '../../src/domain/engine/region-size';
import { CellNode, ShapeGroup } from '../../src/domain/engine/shape-node';
import { Turns } from '../../src/domain/engine/turns';
import { Placement } from '../../src/domain/variants/hexa-fit/placement';
import { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../src/domain/variants/hexa-sort/goal-count';
import { square, squareTopology, type SquareCoord } from '../support/engine/square-topology';

type Same<T> = (left: T, right: T) => boolean;

// The answer in each direction. Each `of()` makes a new object,
// so an `equals` that compares instances gives `DIFFERENT` for two equal values.
function bothWays<T>(same: Same<T>, left: T, right: T): boolean[] {
  return [same(left, right), same(right, left)];
}

const EQUAL = [true, true];
const DIFFERENT = [false, false];

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');

describe('equals of the whole number value objects', () => {
  it('should_be_equal_when_two_radii_hold_the_same_value', () => {
    const same: Same<Radius> = (left, right) => left.equals(right);

    expect(bothWays(same, Radius.of(2), Radius.of(2))).toEqual(EQUAL);
    expect(bothWays(same, Radius.of(0), Radius.of(-0))).toEqual(EQUAL);
    expect(bothWays(same, Radius.of(2), Radius.of(3))).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_turn_counts_hold_the_same_value', () => {
    const same: Same<Turns> = (left, right) => left.equals(right);

    expect(bothWays(same, Turns.of(-1), Turns.of(-1))).toEqual(EQUAL);
    expect(bothWays(same, Turns.of(0), Turns.of(-0))).toEqual(EQUAL);
    expect(bothWays(same, Turns.of(1), Turns.of(-1))).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_region_sizes_hold_the_same_value', () => {
    const same: Same<RegionSize> = (left, right) => left.equals(right);

    expect(bothWays(same, RegionSize.of(5), RegionSize.of(5))).toEqual(EQUAL);
    expect(bothWays(same, RegionSize.of(5), RegionSize.of(6))).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_goal_counts_hold_the_same_value', () => {
    const same: Same<GoalCount> = (left, right) => left.equals(right);

    expect(bothWays(same, GoalCount.of(3), GoalCount.of(3))).toEqual(EQUAL);
    expect(bothWays(same, GoalCount.of(3), GoalCount.of(4))).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_merge_tiles_hold_the_same_value', () => {
    const same: Same<MergeTile> = (left, right) => left.equals(right);

    expect(bothWays(same, MergeTile.of(4), MergeTile.of(4))).toEqual(EQUAL);
    expect(bothWays(same, MergeTile.of(4), MergeTile.of(8))).toEqual(DIFFERENT);
  });
});

describe('equals of the progress values', () => {
  it('should_be_equal_when_two_game_results_hold_the_same_fields', () => {
    const same: Same<GameResult> = (left, right) => left.equals(right);
    const fields = { gameId: FIT, score: 10, moves: 3, levelId: 'a', elapsedMs: 500 };
    const result = GameResult.of(fields);
    const changed = (change: Partial<typeof fields>) => GameResult.of({ ...fields, ...change });
    const withoutExtras = GameResult.of({ gameId: FIT, score: 10, moves: 3 });

    expect(bothWays(same, result, changed({ gameId: GameId.of('hexa-fit') }))).toEqual(EQUAL);
    expect(bothWays(same, result, changed({ gameId: SORT }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, changed({ score: 11 }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, changed({ moves: 4 }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, changed({ levelId: 'b' }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, changed({ elapsedMs: 501 }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, withoutExtras)).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_progress_records_hold_the_same_fields', () => {
    const same: Same<ProgressRecord> = (left, right) => left.equals(right);
    const fields = { gameId: FIT, score: 10, levelId: 'a', stars: 2 };
    const record = ProgressRecord.of(fields);
    const changed = (change: Partial<typeof fields>) => ProgressRecord.of({ ...fields, ...change });
    const withoutExtras = ProgressRecord.of({ gameId: FIT, score: 10 });

    expect(bothWays(same, record, changed({ gameId: GameId.of('hexa-fit') }))).toEqual(EQUAL);
    expect(bothWays(same, record, changed({ gameId: SORT }))).toEqual(DIFFERENT);
    expect(bothWays(same, record, changed({ score: 11 }))).toEqual(DIFFERENT);
    expect(bothWays(same, record, changed({ levelId: 'b' }))).toEqual(DIFFERENT);
    expect(bothWays(same, record, changed({ stars: 3 }))).toEqual(DIFFERENT);
    expect(bothWays(same, record, withoutExtras)).toEqual(DIFFERENT);
  });
});

describe('equals of Range', () => {
  type Bound = { readonly n: number };
  const byN: Compare<Bound> = (left, right) => left.n - right.n;

  it('should_be_equal_when_two_ranges_have_bounds_of_the_same_order', () => {
    const numbers: Same<Range<number>> = (left, right) => left.equals(right);
    const bounds: Same<Range<Bound>> = (left, right) => left.equals(right);
    const low = Range.of({ n: 1 }, { n: 5 }, byN);

    expect(bothWays(numbers, Range.ofNumbers(1, 5), Range.ofNumbers(1, 5))).toEqual(EQUAL);
    expect(bothWays(numbers, Range.ofNumbers(0, 5), Range.ofNumbers(-0, 5))).toEqual(EQUAL);
    expect(bothWays(numbers, Range.ofNumbers(1, 5), Range.ofNumbers(2, 5))).toEqual(DIFFERENT);
    expect(bothWays(numbers, Range.ofNumbers(1, 5), Range.ofNumbers(1, 6))).toEqual(DIFFERENT);
    expect(bothWays(bounds, low, Range.of({ n: 1 }, { n: 5 }, byN))).toEqual(EQUAL);
    expect(bothWays(bounds, low, Range.of({ n: 1 }, { n: 6 }, byN))).toEqual(DIFFERENT);
  });

  it('should_give_one_answer_in_both_directions_when_two_ranges_use_different_orders', () => {
    const exact: Compare<string> = (left, right) => {
      if (left === right) return 0;
      return left < right ? -1 : 1;
    };
    const anyCase: Compare<string> = (left, right) =>
      exact(left.toLowerCase(), right.toLowerCase());
    const same: Same<Range<string>> = (left, right) => left.equals(right);
    const lower = Range.of<string>('a', 'z', exact);
    const upper = Range.of<string>('A', 'Z', anyCase);

    expect(bothWays(same, lower, upper)).toEqual(DIFFERENT);
  });
});

describe('equals of the values that hold a coordinate', () => {
  const A = square(0, 0);
  const B = square(1, 0);
  const C = square(0, 1);

  it('should_be_equal_when_two_board_shapes_cover_the_same_coordinates', () => {
    const same: Same<BoardShape<SquareCoord>> = (left, right) => left.equals(right, squareTopology);
    const shape = BoardShape.of([A, B]);

    expect(bothWays(same, shape, BoardShape.of([square(0, 0), square(1, 0)]))).toEqual(EQUAL);
    expect(bothWays(same, shape, BoardShape.of([B, A]))).toEqual(EQUAL);
    expect(bothWays(same, shape, BoardShape.of([A, C]))).toEqual(DIFFERENT);
    expect(bothWays(same, shape, BoardShape.of([A]))).toEqual(DIFFERENT);
    expect(bothWays(same, BoardShape.of([A, A, B]), BoardShape.of([A, B, B]))).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_placements_have_the_same_rotation_and_offset', () => {
    const same: Same<Placement<SquareCoord>> = (left, right) => left.equals(right, squareTopology);
    const placed = (turns: number, at: SquareCoord) =>
      Placement.of(Turns.of(turns), at, squareTopology);

    expect(bothWays(same, placed(1, A), placed(1, square(0, 0)))).toEqual(EQUAL);
    expect(bothWays(same, placed(1, A), placed(5, A))).toEqual(EQUAL);
    expect(bothWays(same, placed(1, A), placed(2, A))).toEqual(DIFFERENT);
    expect(bothWays(same, placed(1, A), placed(1, B))).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_pieces_cover_the_same_coordinates_with_equal_content', () => {
    const same: Same<Piece<Color, SquareCoord>> = (left, right) =>
      left.equals(right, squareTopology, (one, two) => one.equals(two));
    const piece = (cells: SquareCoord[], color: string) =>
      new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), Color.of(color));
    const red = piece([A, B], 'red');
    const leaf = new Piece(new CellNode(A), Color.of('red'));

    expect(bothWays(same, red, piece([square(0, 0), square(1, 0)], 'red'))).toEqual(EQUAL);
    expect(bothWays(same, red, piece([B, A], 'red'))).toEqual(EQUAL);
    expect(bothWays(same, leaf, piece([A], 'red'))).toEqual(EQUAL);
    expect(bothWays(same, red, piece([A, C], 'red'))).toEqual(DIFFERENT);
    expect(bothWays(same, red, piece([A], 'red'))).toEqual(DIFFERENT);
    expect(bothWays(same, red, piece([A, B], 'blue'))).toEqual(DIFFERENT);
  });
});

describe('equals of ColorStack', () => {
  const RED = Color.of('red');
  const BLUE = Color.of('blue');

  it('should_be_equal_when_two_stacks_hold_equal_colors_in_the_same_order', () => {
    const same: Same<ColorStack> = (left, right) => left.equals(right);
    const stack = ColorStack.of([RED, BLUE]);
    const twin = ColorStack.of([Color.of('red'), Color.of('blue')]);

    expect(bothWays(same, stack, twin)).toEqual(EQUAL);
    expect(bothWays(same, ColorStack.empty(), ColorStack.of([]))).toEqual(EQUAL);
    expect(bothWays(same, stack, ColorStack.of([BLUE, RED]))).toEqual(DIFFERENT);
    expect(bothWays(same, ColorStack.of([RED]), ColorStack.of([RED, RED]))).toEqual(DIFFERENT);
    expect(bothWays(same, ColorStack.of([RED]), ColorStack.empty())).toEqual(DIFFERENT);
  });
});
