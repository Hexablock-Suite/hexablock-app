/** @jest-environment node */
import { hex, HexTopology } from '../../../src/domain/engine/hex-topology';
import { square, SquareTopology } from '../../../src/domain/engine/square-topology';
import { triangle, TriangleTopology } from '../../../src/domain/engine/triangle-topology';
import { valuesOf, type ScreenPoint } from '../../../src/infrastructure/board/board-layout';
import { HexLayout } from '../../../src/infrastructure/board/hex-layout';
import { SquareLayout } from '../../../src/infrastructure/board/square-layout';
import { TriangleLayout } from '../../../src/infrastructure/board/triangle-layout';

// Issue #165: the screen layout of each board figure (D4, D11).
// A layout gives the center of the circle inside each cell, and the diameter of that circle.
// The center of the origin cell is (0, 0). `x` grows to the right, and `y` grows down.
// The tests build each expected point from the geometry of the figure by hand.

// √3 / 2: the height of an equilateral triangle with a side of 1.
const HALF_ROOT_3 = Math.sqrt(3) / 2;

function expectPoint(actual: ScreenPoint, x: number, y: number): void {
  expect(actual.x).toBeCloseTo(x, 9);
  expect(actual.y).toBeCloseTo(y, 9);
}

const distance = (a: ScreenPoint, b: ScreenPoint) => Math.hypot(a.x - b.x, a.y - b.y);

describe('HexLayout', () => {
  it('should_place_a_step_east_one_size_right_and_a_step_south_east_half_a_size_right_when_cells_are_placed', () => {
    const layout = new HexLayout(20);

    expect(layout.cellSize()).toBe(20);
    expectPoint(layout.centerOf(hex(0, 0)), 0, 0);
    expectPoint(layout.centerOf(hex(1, 0)), 20, 0);
    expectPoint(layout.centerOf(hex(0, 1)), 10, 20 * HALF_ROOT_3);
    expectPoint(layout.centerOf(hex(-1, 1)), -10, 20 * HALF_ROOT_3);
    expectPoint(layout.centerOf(hex(2, -3)), 10, -60 * HALF_ROOT_3);
  });

  it('should_keep_the_circles_of_two_neighbors_one_size_apart_when_the_six_neighbors_are_placed', () => {
    const layout = new HexLayout(20);
    const topology = new HexTopology();
    const center = hex(2, -1);

    for (const neighbor of topology.neighbors(center)) {
      expect(distance(layout.centerOf(center), layout.centerOf(neighbor))).toBeCloseTo(20, 9);
    }
  });
});

describe('SquareLayout', () => {
  it('should_place_each_column_and_row_one_size_apart_when_cells_are_placed', () => {
    const layout = new SquareLayout(20);

    expect(layout.cellSize()).toBe(20);
    expectPoint(layout.centerOf(square(0, 0)), 0, 0);
    expectPoint(layout.centerOf(square(1, 0)), 20, 0);
    expectPoint(layout.centerOf(square(0, 1)), 0, 20);
    expectPoint(layout.centerOf(square(3, -2)), 60, -40);
  });

  it('should_keep_the_circles_of_two_neighbors_one_size_apart_when_the_four_neighbors_are_placed', () => {
    const layout = new SquareLayout(20);
    const topology = new SquareTopology();
    const center = square(-1, 2);

    for (const neighbor of topology.neighbors(center)) {
      expect(distance(layout.centerOf(center), layout.centerOf(neighbor))).toBeCloseTo(20, 9);
    }
  });
});

describe('TriangleLayout', () => {
  // A triangle has a side of √3 sizes and a height of 1.5 sizes.
  // The circle inside an up triangle sits 2/3 of the height below its top corner.
  // The circle inside a down triangle sits 1/3 of the height below its top side.
  it('should_place_a_down_triangle_half_a_size_above_the_up_triangle_of_its_row_when_cells_are_placed', () => {
    const layout = new TriangleLayout(20);

    expect(layout.cellSize()).toBe(20);
    expectPoint(layout.centerOf(triangle(0, 0)), 0, 0);
    expectPoint(layout.centerOf(triangle(1, 0)), 20 * HALF_ROOT_3, -10);
    expectPoint(layout.centerOf(triangle(0, 1)), 0, 20);
    expectPoint(layout.centerOf(triangle(1, 1)), 20 * HALF_ROOT_3, 30);
    expectPoint(layout.centerOf(triangle(-1, 0)), -20 * HALF_ROOT_3, -10);
    expectPoint(layout.centerOf(triangle(3, -2)), 60 * HALF_ROOT_3, -70);
  });

  it('should_keep_the_circles_of_two_neighbors_one_size_apart_when_the_three_neighbors_are_placed', () => {
    const layout = new TriangleLayout(20);
    const topology = new TriangleTopology();

    for (const center of [triangle(2, 1), triangle(3, 1)]) {
      for (const neighbor of topology.neighbors(center)) {
        expect(distance(layout.centerOf(center), layout.centerOf(neighbor))).toBeCloseTo(20, 9);
      }
    }
  });
});

describe('valuesOf', () => {
  it('should_throw_an_error_when_a_coordinate_delivers_no_values', () => {
    expect(() => valuesOf({ deliverTo: () => undefined })).toThrow(
      new Error('The coordinate delivered no values.'),
    );
  });
});
