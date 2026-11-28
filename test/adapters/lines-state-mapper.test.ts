/** @jest-environment node */
import { LinesStateMapper } from '../../src/adapters/lines-state-mapper';
import { Color } from '../../src/domain/engine/color';
import { Piece } from '../../src/domain/engine/board/piece';
import { CellNode, ShapeGroup } from '../../src/domain/engine/geometry/shape-node';
import { LinesView } from '../../src/domain/variants/hexa-lines/lines-state';
import { square, type SquareCoord } from '../support/engine/square-topology';

const mapper = new LinesStateMapper<SquareCoord>();

describe('LinesStateMapper', () => {
  it('should_show_the_color_only_when_a_space_is_occupied', () => {
    expect(mapper.toView(Color.of('blue'))).toEqual({ color: 'blue' });
    expect(mapper.freeView()).toEqual({});
  });

  it('should_keep_the_tray_order_colors_and_relative_cells_when_mapping_pieces', () => {
    const origin = square(0, 0);
    const east = square(1, 0);
    const north = square(0, -1);
    const red = new Piece(
      new ShapeGroup([new CellNode(origin), new CellNode(east)]),
      Color.of('red'),
    );
    const blue = new Piece(
      new ShapeGroup([new CellNode(origin), new CellNode(north)]),
      Color.of('blue'),
    );
    const green = new Piece(new CellNode(origin), Color.of('green'));

    expect(mapper.toPayload(new LinesView([red, blue, green]))).toEqual({
      tray: [
        { color: 'red', cells: [origin, east] },
        { color: 'blue', cells: [origin, north] },
        { color: 'green', cells: [origin] },
      ],
    });
  });

  it('should_show_no_pieces_when_the_tray_is_empty', () => {
    expect(mapper.toPayload(new LinesView<SquareCoord>([]))).toEqual({ tray: [] });
  });
});
