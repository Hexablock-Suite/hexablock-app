/** @jest-environment node */
import { hex, HexTopology, type HexCoord } from '../../../src/domain/engine/geometry/hex-topology';
import {
  square,
  SquareTopology,
  type SquareCoord,
} from '../../../src/domain/engine/geometry/square-topology';
import { triangle, TriangleTopology } from '../../../src/domain/engine/geometry/triangle-topology';
import {
  valuesOf,
  type BoardLayout,
  type ScreenPoint,
} from '../../../src/adapters/board/board-layout';
import { HexLayout } from '../../../src/adapters/board/hex-layout';
import { SquareLayout } from '../../../src/adapters/board/square-layout';
import { TriangleLayout } from '../../../src/adapters/board/triangle-layout';

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

// Issue #296: the outline of a cell. `outlineOf()` gives the corners of a cell around its center.
// Two neighbor cells share one whole side, and they lie on the two sides of it.
// So the outlines touch with no gap and no overlap. Each side of a cell is the side
// of one neighbor, so the outlines of a board leave no hole between them.

// The corners of the outline of `at` on the screen.
function cornersOf<TCoord>(layout: BoardLayout<TCoord>, at: TCoord): ScreenPoint[] {
  const center = layout.centerOf(at);
  return layout.outlineOf(at).map(({ x, y }) => ({ x: center.x + x, y: center.y + y }));
}

const samePoint = (a: ScreenPoint, b: ScreenPoint) => distance(a, b) < 1e-9;

// The side `[a, b]`, from one corner to the next, of each side of an outline.
function sidesOf(corners: readonly ScreenPoint[]): [ScreenPoint, ScreenPoint][] {
  return corners.map((corner, index) => [corner, corners[(index + 1) % corners.length]]);
}

// The sign of the side of the line `[a, b]` on which the point `p` lies.
function sideOf([a, b]: [ScreenPoint, ScreenPoint], p: ScreenPoint): number {
  return Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
}

// The sides of the cell `at` that a neighbor shares. A shared side has the same two corners
// in the two outlines, and the two cells lie on its two sides.
function sharedSides<TCoord>(
  layout: BoardLayout<TCoord>,
  at: TCoord,
  neighbors: readonly TCoord[],
): number {
  const sides = sidesOf(cornersOf(layout, at));
  return neighbors.filter((neighbor) => {
    const shared = sides.filter((side) =>
      sidesOf(cornersOf(layout, neighbor)).some(
        ([a, b]) =>
          (samePoint(a, side[0]) && samePoint(b, side[1])) ||
          (samePoint(a, side[1]) && samePoint(b, side[0])),
      ),
    );
    if (shared.length !== 1) return false;
    const [side] = shared;
    return sideOf(side, layout.centerOf(at)) * sideOf(side, layout.centerOf(neighbor)) === -1;
  }).length;
}

describe('outlineOf', () => {
  it('should_share_one_side_with_each_of_the_six_neighbors_when_the_figure_is_the_hexagon', () => {
    const layout: BoardLayout<HexCoord> = new HexLayout(20);
    const center = hex(2, -1);
    const neighbors = new HexTopology().neighbors(center);

    expect(layout.outlineOf(center)).toHaveLength(6);
    expect(sharedSides(layout, center, neighbors)).toBe(6);
  });

  it('should_share_one_side_with_each_of_the_four_neighbors_when_the_figure_is_the_square', () => {
    const layout: BoardLayout<SquareCoord> = new SquareLayout(20);
    const center = square(-1, 2);
    const neighbors = new SquareTopology().neighbors(center);

    expect(layout.outlineOf(center)).toHaveLength(4);
    expect(sharedSides(layout, center, neighbors)).toBe(4);
  });

  it('should_share_one_side_with_each_of_the_three_neighbors_when_the_figure_is_the_triangle', () => {
    const layout = new TriangleLayout(20);
    const topology = new TriangleTopology();

    for (const center of [triangle(2, 1), triangle(3, 1)]) {
      expect(layout.outlineOf(center)).toHaveLength(3);
      expect(sharedSides(layout, center, topology.neighbors(center))).toBe(3);
    }
  });

  it('should_point_up_or_down_as_the_coordinate_does_when_the_figure_is_the_triangle', () => {
    const layout = new TriangleLayout(20);
    const top = (at: ReturnType<typeof triangle>) =>
      layout
        .outlineOf(at)
        .filter(({ y }) => y === Math.min(...layout.outlineOf(at).map((c) => c.y))).length;

    expect(triangle(0, 0).isUp()).toBe(true);
    expect(top(triangle(0, 0))).toBe(1);
    expect(triangle(1, 0).isUp()).toBe(false);
    expect(top(triangle(1, 0))).toBe(2);
  });
});

describe('valuesOf', () => {
  it('should_throw_an_error_when_a_coordinate_delivers_no_values', () => {
    expect(() => valuesOf({ deliverTo: () => undefined })).toThrow(
      new Error('The coordinate delivered no values.'),
    );
  });
});
