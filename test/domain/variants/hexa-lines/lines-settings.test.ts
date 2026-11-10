/** @jest-environment node */
import type { Color } from '../../../../src/domain/engine/color';
import type { RandomSource } from '../../../../src/domain/engine/random-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { Seed } from '../../../../src/domain/engine/seed';
import { CellNode, ShapeGroup, type ShapeNode } from '../../../../src/domain/engine/shape-node';
import { LinesSettings } from '../../../../src/domain/variants/hexa-lines/lines-factory';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { blue, red } from '../../../support/variants/hexa-lines/lines-game';

// The settings of a Hexa Lines game are a value object (issue 210, classes.md decision 48).

type Shapes = readonly [ShapeNode<SquareCoord>, ...ShapeNode<SquareCoord>[]];
type Colors = readonly [Color, ...Color[]];

const SIZE = RegionSize.of(3);
const SEED = Seed.of(7);
const cell = () => new CellNode(square(0, 0));
const domino = () => new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]);

// A random source that gives the numbers of a list, in order. It doubles the boundary only.
class ListRandom implements RandomSource {
  constructor(private readonly numbers: number[]) {}

  next(): number {
    return this.numbers.shift() ?? 0;
  }

  clone(): ListRandom {
    return new ListRandom([...this.numbers]);
  }
}

// The piece that the settings draw from two numbers, as text.
function drawn(settings: LinesSettings<SquareCoord>, shape: number, color: number): string {
  const piece = settings.drawPiece(new ListRandom([shape, color]));
  const keys = piece.shape.cells().map((c) => squareTopology.key(c));
  return `${piece.content.equals(red) ? 'red' : 'blue'} ${keys.join(' ')}`;
}

describe('LinesSettings', () => {
  it('should_be_equal_when_two_lines_settings_hold_the_same_data', () => {
    const one = LinesSettings.of(SIZE, SEED, [cell(), domino()], [red, blue]);
    const other = LinesSettings.of(RegionSize.of(3), Seed.of(7), [cell(), domino()], [red, blue]);

    expect(one).not.toBe(other);
    expect(one.equals(other, squareTopology)).toBe(true);
    expect(other.equals(one, squareTopology)).toBe(true);
  });

  it('should_not_be_equal_when_two_lines_settings_differ_in_one_part', () => {
    const settings = LinesSettings.of(SIZE, SEED, [cell(), domino()], [red, blue]);
    const others = [
      LinesSettings.of(RegionSize.of(4), SEED, [cell(), domino()], [red, blue]),
      LinesSettings.of(SIZE, Seed.of(8), [cell(), domino()], [red, blue]),
      LinesSettings.of(SIZE, SEED, [cell()], [red, blue]),
      // A draw picks a shape and a color by its place in the list, so the order counts.
      LinesSettings.of(SIZE, SEED, [domino(), cell()], [red, blue]),
      LinesSettings.of(SIZE, SEED, [cell(), domino()], [red]),
      LinesSettings.of(SIZE, SEED, [cell(), domino()], [blue, red]),
    ];

    for (const other of others) {
      expect([
        settings.equals(other, squareTopology),
        other.equals(settings, squareTopology),
      ]).toEqual([false, false]);
    }
  });

  it('should_throw_a_range_error_when_the_lines_settings_get_no_shape_or_no_color', () => {
    // Only a cast gives an empty list, as a broken settings file would.
    const none = [] as unknown as Shapes;
    const noColor = [] as unknown as Colors;

    expect(() => LinesSettings.of(SIZE, SEED, none, [red])).toThrow(
      new RangeError('The Lines settings need one shape or more.'),
    );
    expect(() => LinesSettings.of(SIZE, SEED, [cell()], noColor)).toThrow(
      new RangeError('The Lines settings need one color or more.'),
    );
  });

  it('should_throw_a_range_error_when_a_list_of_the_lines_settings_holds_undefined', () => {
    const shapes = [cell(), undefined] as unknown as Shapes;
    const colors = [red, undefined] as unknown as Colors;

    expect(() => LinesSettings.of(SIZE, SEED, shapes, [red])).toThrow(
      new RangeError('A piece list cannot hold undefined.'),
    );
    expect(() => LinesSettings.of(SIZE, SEED, [cell()], colors)).toThrow(
      new RangeError('A piece list cannot hold undefined.'),
    );
  });

  it('should_keep_its_lists_when_the_arrays_that_built_the_lines_settings_change', () => {
    const shapes: [ShapeNode<SquareCoord>, ...ShapeNode<SquareCoord>[]] = [cell()];
    const colors: [Color, ...Color[]] = [red];
    const settings = LinesSettings.of(SIZE, SEED, shapes, colors);

    shapes[0] = domino();
    colors[0] = blue;
    shapes.push(domino());

    expect(drawn(settings, 0.99, 0.99)).toBe('red 0,0');
    expect(settings.equals(LinesSettings.of(SIZE, SEED, [cell()], [red]), squareTopology)).toBe(
      true,
    );
  });

  it('should_refuse_a_write_when_a_caller_changes_the_lines_settings', () => {
    const settings = LinesSettings.of(SIZE, SEED, [cell()], [red]);

    expect(Object.isFrozen(settings)).toBe(true);
    expect(Reflect.set(settings, 'seed', Seed.of(8))).toBe(false);
    expect(Reflect.set(settings, 'colors', [blue])).toBe(false);
    expect(settings.equals(LinesSettings.of(SIZE, SEED, [cell()], [red]), squareTopology)).toBe(
      true,
    );
  });

  it('should_pick_the_shape_with_the_first_number_and_the_color_with_the_second_when_a_piece_is_drawn', () => {
    const settings = LinesSettings.of(SIZE, SEED, [cell(), domino()], [red, blue]);

    expect(drawn(settings, 0, 0)).toBe('red 0,0');
    expect(drawn(settings, 0.5, 0)).toBe('red 0,0 1,0');
    expect(drawn(settings, 0.49, 0.5)).toBe('blue 0,0');
    expect(drawn(settings, 0.99, 0.99)).toBe('blue 0,0 1,0');
  });

  it('should_give_its_board_size_and_its_seed_when_the_factory_asks', () => {
    const settings = LinesSettings.of(SIZE, SEED, [cell()], [red]);

    expect(settings.boardSize().equals(RegionSize.of(3))).toBe(true);
    expect(settings.pieceSeed().equals(Seed.of(7))).toBe(true);
  });
});
