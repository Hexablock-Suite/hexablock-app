import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import type { MoveResult } from '../../../src/application/move-result';
import { hex, type HexCoord } from '../../../src/domain/engine/hex-topology';
import { Outcome } from '../../../src/domain/engine/outcome';
import { Score } from '../../../src/domain/engine/score';
import { square, type SquareCoord } from '../../../src/domain/engine/square-topology';
import { triangle, type TriangleCoord } from '../../../src/domain/engine/triangle-topology';
import type { BoardLayout } from '../../../src/infrastructure/board/board-layout';
import { BoardView } from '../../../src/infrastructure/board/board-view';
import type { CellRenderer } from '../../../src/infrastructure/board/cell-renderer';
import { HexLayout } from '../../../src/infrastructure/board/hex-layout';
import { SquareLayout } from '../../../src/infrastructure/board/square-layout';
import { TriangleLayout } from '../../../src/infrastructure/board/triangle-layout';

// Issue #165: `BoardView` draws the cells of a `MoveResult` on any figure.
// The layout of the figure places each cell, and a fake `CellRenderer` draws it.
// The fake cell is a name that exists only in this test. The renderer draws one element
// with the test id `cell-<name>`, so the test finds each cell and the box around it.
// The frame of the board wraps the boxes of the cells, so the leftmost box starts at 0
// and the topmost box starts at 0.

const SIZE = 20;
// √3 / 2: the height of an equilateral triangle with a side of 1.
const HALF_ROOT_3 = Math.sqrt(3) / 2;

const fakeRenderer: CellRenderer<string> = {
  render: (name) => <View testID={`cell-${name}`} />,
};

// A plain response of layer 2 with the cells `cells` and the values of a new game.
function responseWith<TCoord>(cells: [TCoord, string][]): MoveResult<string, TCoord> {
  return {
    cells,
    freeSpaces: [],
    score: Score.of(0),
    outcome: Outcome.playing,
    canUndo: false,
    canRedo: false,
    hasUndo: false,
    payload: undefined,
  };
}

type Box = { left: number; top: number; width: number; height: number };
// A drawn host element, as the queries of the screen give it.
type Drawn = ReturnType<typeof screen.getByTestId>;

// The flat style of a drawn element.
function styleOf(element: Drawn | null): Record<string, unknown> {
  return StyleSheet.flatten(element?.props.style) ?? {};
}

// The box that `BoardView` gives to the cell `name`: the parent of the element of the renderer.
function boxOf(name: string): Drawn | null {
  return screen.getByTestId(`cell-${name}`).parent;
}

function expectBox(name: string, expected: Box): void {
  const style = styleOf(boxOf(name));

  expect(style.position).toBe('absolute');
  for (const [side, value] of Object.entries(expected)) {
    expect(style[side]).toBeCloseTo(value, 9);
  }
}

function expectFrame(name: string, width: number, height: number): void {
  const frame = styleOf(boxOf(name)?.parent ?? null);

  expect(frame.width).toBeCloseTo(width, 9);
  expect(frame.height).toBeCloseTo(height, 9);
}

async function draw<TCoord>(
  result: MoveResult<string, TCoord>,
  layout: BoardLayout<TCoord>,
): Promise<void> {
  await render(
    <BoardView cells={result.cells} layout={layout} renderer={fakeRenderer} label="Tablero" />,
  );
}

describe('BoardView', () => {
  it('should_draw_one_box_per_cell_at_its_hex_place_when_the_figure_is_the_hexagon', async () => {
    const result = responseWith<HexCoord>([
      [hex(0, 0), 'a'],
      [hex(1, 0), 'b'],
      [hex(0, 1), 'c'],
      [hex(-1, 1), 'd'],
    ]);

    await draw(result, new HexLayout(SIZE));

    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(4);
    const row = SIZE * HALF_ROOT_3;
    expectBox('a', { left: 10, top: 0, width: SIZE, height: SIZE });
    expectBox('b', { left: 30, top: 0, width: SIZE, height: SIZE });
    expectBox('c', { left: 20, top: row, width: SIZE, height: SIZE });
    expectBox('d', { left: 0, top: row, width: SIZE, height: SIZE });
    expectFrame('a', 50, row + SIZE);
  });

  it('should_draw_one_box_per_cell_at_its_square_place_when_the_figure_is_the_square', async () => {
    const result = responseWith<SquareCoord>([
      [square(0, 0), 'a'],
      [square(1, 0), 'b'],
      [square(0, 1), 'c'],
      [square(2, 2), 'd'],
    ]);

    await draw(result, new SquareLayout(SIZE));

    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(4);
    expectBox('a', { left: 0, top: 0, width: SIZE, height: SIZE });
    expectBox('b', { left: 20, top: 0, width: SIZE, height: SIZE });
    expectBox('c', { left: 0, top: 20, width: SIZE, height: SIZE });
    expectBox('d', { left: 40, top: 40, width: SIZE, height: SIZE });
    expectFrame('a', 60, 60);
  });

  it('should_draw_one_box_per_cell_at_its_triangle_place_when_the_figure_is_the_triangle', async () => {
    const result = responseWith<TriangleCoord>([
      [triangle(0, 0), 'a'],
      [triangle(1, 0), 'b'],
      [triangle(0, 1), 'c'],
      [triangle(1, 1), 'd'],
    ]);

    await draw(result, new TriangleLayout(SIZE));

    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(4);
    const across = SIZE * HALF_ROOT_3;
    expectBox('a', { left: 0, top: 10, width: SIZE, height: SIZE });
    expectBox('b', { left: across, top: 0, width: SIZE, height: SIZE });
    expectBox('c', { left: 0, top: 30, width: SIZE, height: SIZE });
    expectBox('d', { left: across, top: 40, width: SIZE, height: SIZE });
    expectFrame('a', across + SIZE, 60);
  });

  // Issue #170: the screen reader names the board with a text of the catalog.
  it('should_give_the_frame_the_accessible_name_when_the_board_gets_a_label', async () => {
    await draw(responseWith<HexCoord>([[hex(0, 0), 'a']]), new HexLayout(SIZE));

    expect(screen.getByLabelText('Tablero')).toBe(boxOf('a')?.parent);
  });

  it('should_draw_no_cell_and_an_empty_frame_when_the_response_holds_no_cell', async () => {
    await draw(responseWith<HexCoord>([]), new HexLayout(SIZE));

    expect(screen.queryAllByTestId(/^cell-/)).toHaveLength(0);
    const frame = screen.toJSON();
    const style = StyleSheet.flatten(
      frame !== null && !Array.isArray(frame) && 'props' in frame ? frame.props.style : undefined,
    );
    expect(style).toEqual(expect.objectContaining({ width: 0, height: 0 }));
  });
});
