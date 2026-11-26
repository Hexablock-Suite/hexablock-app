import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import type { FitCellView } from '../../../src/adapters/fit-state-mapper';
import type { MergeCellView } from '../../../src/adapters/merge-state-mapper';
import type { SpaceView } from '../../../src/adapters/space-view';
import { hex, type HexCoord } from '../../../src/domain/engine/hex-topology';
import { square, type SquareCoord } from '../../../src/domain/engine/square-topology';
import { triangle, type TriangleCoord } from '../../../src/domain/engine/triangle-topology';
import type { BoardLayout } from '../../../src/infrastructure/board/board-layout';
import { BoardView } from '../../../src/infrastructure/board/board-view';
import type { CellRenderer } from '../../../src/infrastructure/board/cell-renderer';
import { FitCellRenderer } from '../../../src/infrastructure/board/fit-cell-renderer';
import { HexLayout } from '../../../src/infrastructure/board/hex-layout';
import { MergeCellRenderer } from '../../../src/infrastructure/board/merge-cell-renderer';
import { SpaceCellRenderer } from '../../../src/infrastructure/board/space-cell-renderer';
import { SquareLayout } from '../../../src/infrastructure/board/square-layout';
import { TriangleLayout } from '../../../src/infrastructure/board/triangle-layout';
import { outlinesIn, type Outline } from '../../support/ui/cell-outlines';

// Issue #296: each space of the board shows the shape of its figure (APP-FR-16).
// A hexagon has six corners, a square four and a triangle three. A triangle points up
// or down as its coordinate does. Every cell renderer draws that shape on a free space
// and on an occupied space. The test finds the spaces by their test ids, in the order
// of the cells that `BoardView` takes, and reads the outlines that each space draws.

const SIZE = 40;

// The three cell renderers of the game registry, each with a free view and an occupied view.
const space = new SpaceCellRenderer();
const fit = new FitCellRenderer();
const merge = new MergeCellRenderer();
const FREE: SpaceView = { occupied: false };
const TAKEN: SpaceView = { occupied: true };
const FIT_FREE: FitCellView = {};
const FIT_TAKEN: FitCellView = { piece: 'a' };
const MERGE_FREE: MergeCellView = {};
const MERGE_TAKEN: MergeCellView = { value: 8 };

// The outlines of each space of a board, in the order of `cells`.
// Each space must draw at least one outline.
async function spaceOutlines<TCellView, TCoord>(
  coords: readonly TCoord[],
  views: readonly TCellView[],
  layout: BoardLayout<TCoord>,
  renderer: CellRenderer<TCellView>,
): Promise<Outline[][]> {
  const cells = coords.map((at, index) => [at, views[index % views.length]] as const);
  const board: ReactElement = (
    <BoardView cells={cells} layout={layout} renderer={renderer} label="Tablero" />
  );
  await render(board);
  const spaces = screen.queryAllByTestId(/^space-(free|occupied)$/, {
    includeHiddenElements: true,
  });
  expect(spaces.map((each) => each.props.testID)).toEqual(
    cells.map(([, view]) => (views.indexOf(view) === 0 ? 'space-free' : 'space-occupied')),
  );
  const outlines = spaces.map((each) => outlinesIn(each));
  for (const drawn of outlines) expect(drawn.length).toBeGreaterThan(0);
  return outlines;
}

// The corner count and the way of each drawn outline of each space.
function shapesOf(outlines: Outline[][]): string[][] {
  return outlines.map((drawn) => drawn.map((each) => `${each.corners}:${each.points}`));
}

// The renderers of the game registry, each drawn on the board `coords` of `layout`.
async function everyRendererShape<TCoord>(
  coords: readonly TCoord[],
  layout: BoardLayout<TCoord>,
): Promise<string[][][]> {
  return [
    shapesOf(await spaceOutlines(coords, [FREE, TAKEN], layout, space)),
    shapesOf(await spaceOutlines(coords, [FIT_FREE, FIT_TAKEN], layout, fit)),
    shapesOf(await spaceOutlines(coords, [MERGE_FREE, MERGE_TAKEN], layout, merge)),
  ];
}

// The expected shapes of `ways`, one way per space, for each of the three renderers.
function expected(ways: readonly string[], drawn: string[][][]): string[][][] {
  return drawn.map((spaces) => spaces.map((outlines, index) => outlines.map(() => ways[index])));
}

describe('cell shapes', () => {
  it('should_draw_a_hexagon_on_every_free_and_occupied_space_when_the_figure_is_the_hexagon', async () => {
    const coords: HexCoord[] = [hex(0, 0), hex(1, 0), hex(0, 1), hex(-1, 1), hex(1, -1)];

    const drawn = await everyRendererShape(coords, new HexLayout(SIZE));

    expect(drawn).toEqual(
      expected(
        coords.map(() => '6:pointy'),
        drawn,
      ),
    );
  });

  it('should_draw_a_square_on_every_free_and_occupied_space_when_the_figure_is_the_square', async () => {
    const coords: SquareCoord[] = [square(0, 0), square(1, 0), square(0, 1), square(1, 1)];

    const drawn = await everyRendererShape(coords, new SquareLayout(SIZE));

    expect(drawn).toEqual(
      expected(
        coords.map(() => '4:flat'),
        drawn,
      ),
    );
  });

  it('should_draw_a_triangle_that_points_as_its_coordinate_on_every_space_when_the_figure_is_the_triangle', async () => {
    const coords: TriangleCoord[] = [
      triangle(0, 0),
      triangle(1, 0),
      triangle(2, 0),
      triangle(0, 1),
      triangle(1, 1),
    ];

    const drawn = await everyRendererShape(coords, new TriangleLayout(SIZE));

    expect(drawn).toEqual(
      expected(
        coords.map((at) => (at.isUp() ? '3:up' : '3:down')),
        drawn,
      ),
    );
  });
});
