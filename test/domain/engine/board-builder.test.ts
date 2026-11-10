/** @jest-environment node */
import { Board } from '../../../src/domain/engine/board';
import { BoardBuilder } from '../../../src/domain/engine/board-builder';
import type { GeometryFactory } from '../../../src/domain/engine/geometry-factory';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { hex, type HexCoord } from '../../../src/domain/engine/hex-topology';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { CellNode, ShapeGroup } from '../../../src/domain/engine/shape-node';
import { square, squareTopology, type SquareCoord } from '../../support/engine/square-topology';
import { BOARD_ID } from '../../support/engine/entity-ids';

// `BoardBuilder` is the Builder and the DDD factory of the board
// (issue 153, classes.md decision 15, D9).

function figure(...cells: HexCoord[]): ShapeGroup<HexCoord> {
  return new ShapeGroup(cells.map((c) => new CellNode(c)));
}

function hexBuilder(): BoardBuilder<HexCoord> {
  return new BoardBuilder(new HexGeometry());
}

describe('BoardBuilder', () => {
  it('should_build_an_empty_board_of_the_hex_region_when_the_builder_takes_a_region', () => {
    const board = hexBuilder().withRegion(RegionSize.of(2)).build<string>(BOARD_ID);

    expect(board).toBeInstanceOf(Board);
    expect(board.shape.cells).toHaveLength(7);
    expect(board.contains(hex(1, -1))).toBe(true);
    expect(board.contains(hex(2, 0))).toBe(false);
    expect([...board.neighborhood(hex(0, 0))]).toHaveLength(6);
    expect(board.cells()).toEqual([]);
  });

  it('should_build_an_empty_board_of_the_figure_when_the_builder_takes_a_figure', () => {
    const cells = [hex(0, 0), hex(1, 0), hex(1, 1)];

    const board = hexBuilder()
      .withFigure(figure(...cells))
      .build<string>(BOARD_ID);

    expect(board).toBeInstanceOf(Board);
    expect(board.shape.cells).toEqual(cells);
    expect(board.contains(hex(1, 1))).toBe(true);
    expect(board.contains(hex(0, 1))).toBe(false);
    expect(board.cells()).toEqual([]);
  });

  it('should_return_the_builder_when_a_step_runs', () => {
    const builder = hexBuilder();

    expect(builder.withRegion(RegionSize.of(1))).toBe(builder);
    expect(builder.withFigure(figure(hex(0, 0)))).toBe(builder);
  });

  it('should_throw_a_range_error_when_build_runs_before_a_step', () => {
    const build = () => hexBuilder().build(BOARD_ID);

    expect(build).toThrow(RangeError);
    expect(build).toThrow('A board builder needs a region or a figure.');
  });

  it('should_keep_the_board_invariant_when_a_figure_repeats_a_coordinate', () => {
    const build = () =>
      hexBuilder()
        .withFigure(figure(hex(0, 0), hex(1, 0), hex(0, 0)))
        .build(BOARD_ID);

    expect(build).toThrow(RangeError);
    expect(build).toThrow('Two coordinates of the shape have the same key.');
  });

  it('should_use_the_last_step_when_the_builder_takes_both_paths', () => {
    const fromFigure = hexBuilder()
      .withRegion(RegionSize.of(2))
      .withFigure(figure(hex(0, 0)))
      .build(BOARD_ID);
    const fromRegion = hexBuilder()
      .withFigure(figure(hex(0, 0)))
      .withRegion(RegionSize.of(2))
      .build(BOARD_ID);

    expect(fromFigure.shape.cells).toEqual([hex(0, 0)]);
    expect(fromRegion.shape.cells).toHaveLength(7);
  });

  it('should_give_two_boards_that_share_no_cells_when_build_runs_twice', () => {
    const builder = hexBuilder().withRegion(RegionSize.of(2));
    const first = builder.build<string>(BOARD_ID);
    const second = builder.build<string>(BOARD_ID);

    first.occupy(hex(0, 0), 'x');

    expect(second).not.toBe(first);
    expect(second.get(hex(0, 0))).toBeUndefined();
    expect(second.cells()).toEqual([]);
  });

  it('should_use_the_topology_of_its_geometry_when_the_geometry_is_not_hexagonal', () => {
    const geometry: GeometryFactory<SquareCoord> = {
      id: 'square',
      createCoord: ([col = 0, row = 0]) => square(col, row),
      createTopology: () => squareTopology,
      createPieceShapes: () => [],
    };

    const board = new BoardBuilder(geometry).withRegion(RegionSize.of(2)).build<string>(BOARD_ID);

    expect(board.topology).toBe(squareTopology);
    expect(board.shape.cells).toEqual([square(0, 0), square(1, 0), square(0, 1), square(1, 1)]);
  });
});
