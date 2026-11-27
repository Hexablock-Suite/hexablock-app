/** @jest-environment node */
import { BoardShape } from '../../src/domain/engine/board-shape';
import { Color } from '../../src/domain/engine/color';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { LevelId } from '../../src/domain/progress/level-id';
import { MoveCommand } from '../../src/domain/engine/move-command';
import { MoveHistory } from '../../src/domain/engine/move-history';
import { Moves } from '../../src/domain/shared/moves';
import { Piece } from '../../src/domain/engine/piece';
import { GameResult, ProgressRecord } from '../../src/domain/progress/progress-model';
import { Radius } from '../../src/domain/engine/radius';
import { Range } from '../../src/domain/engine/range';
import { RegionSize } from '../../src/domain/engine/region-size';
import { CellNode, ShapeGroup } from '../../src/domain/engine/shape-node';
import { Score } from '../../src/domain/shared/score';
import { Seed } from '../../src/domain/engine/seed';
import { Stars } from '../../src/domain/progress/stars';
import { Turns } from '../../src/domain/engine/turns';
import { UndoLimit } from '../../src/domain/engine/undo-limit';
import { Placement } from '../../src/domain/variants/hexa-fit/placement';
import { Chance } from '../../src/domain/variants/hexa-merge/chance';
import { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../src/domain/variants/hexa-sort/goal-count';
import { Rank } from '../support/engine/rank';
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

// Issue 210: the seed and the chance of a 4 are value objects.
describe('equals of the seed and the chance', () => {
  it('should_be_equal_when_two_seeds_hold_the_same_value', () => {
    const same: Same<Seed> = (left, right) => left.equals(right);

    expect(bothWays(same, Seed.of(42), Seed.of(42))).toEqual(EQUAL);
    expect(bothWays(same, Seed.of(0), Seed.of(-0))).toEqual(EQUAL);
    expect(bothWays(same, Seed.of(42), Seed.of(43))).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_chances_hold_the_same_value', () => {
    const same: Same<Chance> = (left, right) => left.equals(right);

    expect(bothWays(same, Chance.of(0.1), Chance.of(0.1))).toEqual(EQUAL);
    expect(bothWays(same, Chance.of(0), Chance.of(-0))).toEqual(EQUAL);
    expect(bothWays(same, Chance.of(0.1), Chance.of(0.9))).toEqual(DIFFERENT);
  });
});

describe('equals of the progress values', () => {
  it('should_be_equal_when_two_game_results_hold_the_same_fields', () => {
    const same: Same<GameResult> = (left, right) => left.equals(right);
    const fields = {
      gameId: FIT,
      score: Score.of(10),
      moves: Moves.of(3),
      levelId: LevelId.of('a'),
      elapsedMs: ElapsedTime.ofMs(500),
    };
    const result = GameResult.of(fields);
    const changed = (change: Partial<typeof fields>) => GameResult.of({ ...fields, ...change });
    const withoutExtras = GameResult.of({ gameId: FIT, score: Score.of(10), moves: Moves.of(3) });
    // A result of new value objects with the same values, so `equals` cannot compare instances.
    const again = GameResult.of({
      gameId: FIT,
      score: Score.of(10),
      moves: Moves.of(3),
      levelId: LevelId.of('a'),
      elapsedMs: ElapsedTime.ofMs(500),
    });

    expect(bothWays(same, result, again)).toEqual(EQUAL);
    expect(bothWays(same, result, changed({ gameId: GameId.of('hexa-fit') }))).toEqual(EQUAL);
    expect(bothWays(same, result, changed({ gameId: SORT }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, changed({ score: Score.of(11) }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, changed({ moves: Moves.of(4) }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, changed({ levelId: LevelId.of('b') }))).toEqual(DIFFERENT);
    expect(bothWays(same, result, changed({ elapsedMs: ElapsedTime.ofMs(501) }))).toEqual(
      DIFFERENT,
    );
    expect(bothWays(same, result, withoutExtras)).toEqual(DIFFERENT);
  });

  it('should_be_equal_when_two_progress_records_hold_the_same_fields', () => {
    const same: Same<ProgressRecord> = (left, right) => left.equals(right);
    const fields = {
      gameId: FIT,
      score: Score.of(10),
      levelId: LevelId.of('a'),
      stars: Stars.of(2),
    };
    const record = ProgressRecord.of(fields);
    const changed = (change: Partial<typeof fields>) => ProgressRecord.of({ ...fields, ...change });
    const withoutExtras = ProgressRecord.of({ gameId: FIT, score: Score.of(10) });
    // A record of new value objects with the same values, so `equals` cannot compare instances.
    const again = ProgressRecord.of({
      gameId: FIT,
      score: Score.of(10),
      levelId: LevelId.of('a'),
      stars: Stars.of(2),
    });

    expect(bothWays(same, record, again)).toEqual(EQUAL);
    expect(bothWays(same, record, changed({ gameId: GameId.of('hexa-fit') }))).toEqual(EQUAL);
    expect(bothWays(same, record, changed({ gameId: SORT }))).toEqual(DIFFERENT);
    expect(bothWays(same, record, changed({ score: Score.of(11) }))).toEqual(DIFFERENT);
    expect(bothWays(same, record, changed({ levelId: LevelId.of('b') }))).toEqual(DIFFERENT);
    expect(bothWays(same, record, changed({ stars: Stars.of(3) }))).toEqual(DIFFERENT);
    expect(bothWays(same, record, withoutExtras)).toEqual(DIFFERENT);
  });
});

describe('equals of Range', () => {
  // Issue #239: the bounds are value objects that know their order.
  it('should_be_equal_when_the_bounds_of_two_ranges_share_their_places_in_the_order', () => {
    const same: Same<Range<Rank>> = (left, right) => left.equals(right);
    const range = (min: number, max: number) => Range.of(Rank.of(min), Rank.of(max));

    expect(bothWays(same, range(1, 5), range(1, 5))).toEqual(EQUAL);
    expect(bothWays(same, range(1, 5), range(2, 5))).toEqual(DIFFERENT);
    expect(bothWays(same, range(1, 5), range(1, 6))).toEqual(DIFFERENT);
    expect(bothWays(same, range(1, 5), range(0, 6))).toEqual(DIFFERENT);
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

// The class of 2026-11-09: the attributes of a value object are private.
// A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
// when the line compiles, because then the directive is unused.
describe('private fields of the value objects', () => {
  it('should_reject_at_compile_time_when_a_caller_reads_a_field_that_no_production_code_reads', () => {
    const range = Range.of(Rank.of(1), Rank.of(2));
    const placement = Placement.of(Turns.of(1), square(0, 0), squareTopology);
    const readers = [
      // @ts-expect-error `Color.name` is private.
      () => Color.of('red').name,
      // @ts-expect-error `GameId.value` is private.
      () => FIT.value,
      // @ts-expect-error `Range.min` is private.
      () => range.min,
      // @ts-expect-error `Range.max` is private.
      () => range.max,
      // @ts-expect-error `Placement.rotation` is private.
      () => placement.rotation,
      // @ts-expect-error `Placement.at` is private.
      () => placement.at,
      // @ts-expect-error `ColorStack.chips` is private.
      () => ColorStack.empty().chips,
    ];

    expect(readers).toHaveLength(7);
  });

  // Unit R17 of the redesign: six more fields that no production code reads.
  it('should_reject_at_compile_time_when_a_caller_reads_a_field_of_the_second_batch', () => {
    const leaf = new CellNode(square(0, 0));
    const group = new ShapeGroup([leaf]);
    const command = new MoveCommand(
      'the move',
      'the state before',
      'the state after',
      () => undefined,
    );
    const readers = [
      // @ts-expect-error `MergeTile.value` is private.
      () => MergeTile.of(2).value,
      // @ts-expect-error `GoalCount.value` is private.
      () => GoalCount.of(1).value,
      // @ts-expect-error `CellNode.at` is private.
      () => leaf.at,
      // @ts-expect-error `ShapeGroup.children` is private.
      () => group.children,
      // @ts-expect-error `MoveCommand.move` is private.
      () => command.move,
      // @ts-expect-error `MoveHistory.limit` is private.
      () => new MoveHistory<string, string>(UndoLimit.of(1)).limit,
    ];

    expect(readers).toHaveLength(6);
  });
});
