import { FitMoveMapper, type FitIntent } from '../adapters/fit-move-mapper';
import {
  FitStateMapper,
  type FitCellView,
  type FitPayloadView,
} from '../adapters/fit-state-mapper';
import { LinesMoveMapper, type LinesIntent } from '../adapters/lines-move-mapper';
import {
  LinesStateMapper,
  type LinesCellView,
  type LinesPayloadView,
} from '../adapters/lines-state-mapper';
import { MergeMoveMapper, type MergeIntent } from '../adapters/merge-move-mapper';
import { slideWays } from '../adapters/merge-slide-ways';
import {
  MergeStateMapper,
  type MergeCellView,
  type MergePayloadView,
} from '../adapters/merge-state-mapper';
import { SortMoveMapper, type SortIntent } from '../adapters/sort-move-mapper';
import {
  SortStateMapper,
  type SortCellView,
  type SortPayloadView,
} from '../adapters/sort-state-mapper';
import { BoardShape } from '../domain/engine/board-shape';
import type { Clock } from '../domain/engine/clock';
import { Color } from '../domain/engine/color';
import { ElapsedTime } from '../domain/shared/elapsed-time';
import { GameId } from '../domain/shared/game-id';
import type { GeometryFactory } from '../domain/engine/geometry-factory';
import { TopologyId } from '../domain/shared/topology-id';
import type { GridAxis } from '../domain/engine/grid-topology';
import { HexGeometry } from '../domain/engine/hex-geometry';
import { Moves } from '../domain/shared/moves';
import { Piece } from '../domain/engine/piece';
import type { RandomSource } from '../domain/engine/random-source';
import { RegionSize } from '../domain/engine/region-size';
import { CellNode, ShapeGroup } from '../domain/engine/shape-node';
import { SquareGeometry } from '../domain/engine/square-geometry';
import { TriangleGeometry } from '../domain/engine/triangle-geometry';
import { triangle, type TriangleCoord } from '../domain/engine/triangle-topology';
import type { Turns } from '../domain/engine/turns';
import { FitFactory } from '../domain/variants/hexa-fit/fit-factory';
import { FitLevel } from '../domain/variants/hexa-fit/fit-level';
import { fitLevelVariant } from '../domain/variants/hexa-fit/fit-level-variant';
import type { FitMove } from '../domain/variants/hexa-fit/fit-move';
import type { FitView } from '../domain/variants/hexa-fit/fit-state';
import { FitStarThreshold } from '../domain/variants/hexa-fit/fit-stars';
import { PieceId } from '../domain/variants/hexa-fit/piece-id';
import { LinesFactory, LinesSettings } from '../domain/variants/hexa-lines/lines-factory';
import type { LinesView } from '../domain/variants/hexa-lines/lines-state';
import type { PlacePiece } from '../domain/variants/hexa-lines/place-piece';
import { MergeFactory, MergeSettings } from '../domain/variants/hexa-merge/merge-factory';
import type { MergeView } from '../domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../domain/variants/hexa-merge/merge-tile';
import type { Slide } from '../domain/variants/hexa-merge/slide';
import type { ColorStack } from '../domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../domain/variants/hexa-sort/goal-count';
import type { PlaceStack } from '../domain/variants/hexa-sort/place-stack';
import { SortFactory } from '../domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../domain/variants/hexa-sort/sort-level';
import { sortLevelVariant } from '../domain/variants/hexa-sort/sort-level-variant';
import type { SortView } from '../domain/variants/hexa-sort/sort-state';
import {
  cellBoxOf,
  valuesOf,
  type BoardLayout,
  type CellShape,
} from '../adapters/board/board-layout';
import { FitCellRenderer } from './board/fit-cell-renderer';
import { HexLayout } from '../adapters/board/hex-layout';
import { LinesCellRenderer } from './board/lines-cell-renderer';
import { MergeCellRenderer } from './board/merge-cell-renderer';
import { SortCellRenderer } from './board/sort-cell-renderer';
import { SquareLayout } from '../adapters/board/square-layout';
import { TriangleLayout } from '../adapters/board/triangle-layout';
import { registered, type RegisteredGame, type ScreenParts } from './game-registry';
import { FitControls } from './ui/fit-controls';
import { LinesControls } from './ui/lines-controls';
import { MergeControls } from './ui/merge-controls';
import { SortControls } from './ui/sort-controls';
import { worldTone } from './ui/theme';

// The hexagon of radius 4 of Hexa Lines (61 cells), and of radius 2 of Sort and Merge
// (19 cells), as docs/REQUIREMENTS.md §1 gives them. A hex region of size n has radius n - 1.
// The square and the triangle take the same region sizes: 25 squares or 50 triangles
// for Lines, and 9 squares or 18 triangles for Sort and Merge (#171).
// Each game has its own value, so a new board size of one game changes one line here
// (the jury variation «a new board size» of APP-NFR-06, issue #369).
// The Merge value goes to `MergeSettings` and to the slide controls of the Merge screen.
const LINES_BOARD = RegionSize.of(5);
const SORT_BOARD = RegionSize.of(3);
const MERGE_BOARD = RegionSize.of(3);

// The tile that a Merge player tries to make, as in 2048 (A3).
const MERGE_TARGET = MergeTile.of(2048);

// The colors of the Lines pieces and of the Sort stacks. The statement gives no list.
const LINES_COLORS = [Color.of('red'), Color.of('blue'), Color.of('green'), Color.of('yellow')];
const SORT_COLORS = [Color.of('red'), Color.of('blue'), Color.of('green')];
const SORT_GOALS = GoalCount.of(3);
const SORT_PREVIEW_SIZE = 38;

// One board figure that the player can choose (APP-FR-16, issue #171): the `TopologyId` of its
// geometry family, its `GeometryFactory`, the screen layout of the figure for a cell size,
// and the Fit level of the first content on the figure, if the figure has one.
// A figure whose offsets do not count cells, as the triangle, also gives the step from a pressed
// cell to the offset of a Lines move and of a Fit place move (#174, #365).
// `boardFigure()` builds each one, so the geometry, the layout and the level name one coordinate type.
export interface BoardFigure<TCoord> {
  readonly id: TopologyId;
  readonly geometry: GeometryFactory<TCoord>;
  readonly fitLevel?: FitLevel<TCoord>;
  linesPlacementAt?(at: TCoord): TCoord;
  fitPlacementAt?(at: TCoord, rotation: Turns): TCoord;
  layoutOf(size: number): BoardLayout<TCoord>;
}

// The board figures, in the order of the figure selector. The first one, the hexagon,
// is the default figure. The composition root builds one registry for each figure.
// The registry hides the coordinate type, as it hides the types of each variant.
// The first content has one Fit level on each figure (#354), so Fit has an entry on each map.
export function boardFigures(): BoardFigure<unknown>[] {
  const hexagon = new HexGeometry();
  const square = new SquareGeometry();
  const triangle = new TriangleGeometry();
  return [
    boardFigure(
      TopologyId.hex,
      hexagon,
      (size) => new HexLayout(size),
      firstFitLevel(TopologyId.hex, hexagon),
    ),
    boardFigure(
      TopologyId.square,
      square,
      (size) => new SquareLayout(size),
      firstFitLevel(TopologyId.square, square),
    ),
    {
      ...boardFigure(
        TopologyId.triangle,
        triangle,
        (size) => new TriangleLayout(size),
        firstFitLevel(TopologyId.triangle, triangle),
      ),
      linesPlacementAt: triangleLinesPlacementAt,
      fitPlacementAt: triangleFitPlacementAt,
    },
  ];
}

// A tap picks a lattice cell, which holds the up triangle and the down triangle beside it.
// Lines shapes have their origin on the up triangle. The domain move takes lattice steps.
function triangleLinesPlacementAt(at: TriangleCoord): TriangleCoord {
  return latticeCellOf(at);
}

// The topology of the triangle. It turns the origin of a Fit piece.
const TRIANGLES = new TriangleGeometry().createTopology();

// A press puts the origin of the chosen Fit piece, at its rotation step, on the pressed cell (#365).
// A step of the triangle turns around the origin vertex, so the turned origin is another cell.
// The offset of the move counts lattice cells: it is the lattice cell of the pressed cell
// minus the lattice cell of the turned origin. When the pressed cell has the orientation of
// the turned origin, the origin lands on it. Else the origin lands on the other triangle
// of the same lattice cell, as a Lines shape does.
function triangleFitPlacementAt(at: TriangleCoord, rotation: Turns): TriangleCoord {
  const [col, row] = valuesOf(latticeCellOf(at));
  const [originCol, originRow] = valuesOf(
    latticeCellOf(TRIANGLES.rotate(triangle(0, 0), rotation)),
  );
  return triangle(col - originCol, row - originRow);
}

// The lattice cell of a triangle: the lattice cell (i, j) holds the up triangle (2i + j, j)
// and the down triangle on its right.
function latticeCellOf(at: TriangleCoord): TriangleCoord {
  const [col, row] = valuesOf(at);
  return triangle(Math.floor((col - row) / 2), row);
}

// The games of the registry of the board figure `figure`, in the order of the game selector.
// This module is the only one that names a variant factory. The composition root calls it,
// and `route-ids.ts` calls it for the pages of the web export (#411).
// Each entry names the `GameId` of its game next to its factory, and `registered()`
// checks the pair with `isFor()` (issue #234).
// Every variant factory takes the `GeometryFactory` of the figure, so the choice of the figure
// changes only that argument, and no engine or variant file differs (APP-FR-16, #171).
// Lines, Merge and the default Sort level take `random`, and each match draws a new seed from it,
// so each match of the app gets new pieces (issue #417). A Sort level file keeps its seed.
// Fit takes the clock for its level timer (classes.md decision 19).
// Fit offers only the levels whose `topology` names the figure (S3-08 in #151,
// «Propuesta, pendiente del equipo»). A figure with no Fit level has no Fit entry.
// Fit and Sort also take their `LevelVariant` on the geometry of the figure, so `StartGame`
// starts a bundled level by its id (#172). Each level function lives in its variant folder (#407). The Fit level and the Sort level of each entry
// are first content: a start with no level id starts them until the level selector (#173).
// Each variant chooses its state mapper, cell renderer and move controls (#174 to #177),
// and its move mapper (#405).
// Each entry declares the world colors of its game on the map (#298): orange for Lines,
// green for Fit, pink for Sort and blue for Merge, the colors of the team prototype.
// So a game keeps its color on every figure, whatever the place of its entry.
export function registeredGames<TCoord>(
  figure: BoardFigure<TCoord>,
  clock: Clock,
  random: RandomSource,
): RegisteredGame[] {
  const { geometry } = figure;
  return [
    registered(
      GameId.of('hexa-lines'),
      new LinesFactory(
        geometry,
        LinesSettings.of(
          LINES_BOARD,
          nonEmpty(geometry.createPieceShapes()),
          nonEmpty(LINES_COLORS),
        ),
        random,
      ),
      linesScreen(figure),
      worldTone(0),
    ),
    ...fitOn(figure, clock),
    registered(
      GameId.of('hexa-sort'),
      new SortFactory(
        geometry,
        SortLevel.seededEachMatch(SORT_BOARD, SORT_GOALS, nonEmpty(SORT_COLORS)),
        random,
        clock,
      ),
      sortScreen(figure),
      worldTone(2),
      sortLevelVariant(geometry, random, clock),
    ),
    mergeOn(figure, random, MERGE_BOARD),
  ];
}

// The Hexa Merge entry on the board figure `figure`, with a board region of size `board`
// (issue #369). Each match draws its seed from `random` (issue #417). The one value `board` goes to `MergeSettings`
// and to the slide controls, so each way on the screen follows the lines of the board.
export function mergeOn<TCoord>(
  figure: BoardFigure<TCoord>,
  random: RandomSource,
  board: RegionSize,
): RegisteredGame {
  return registered(
    GameId.of('hexa-merge'),
    new MergeFactory(figure.geometry, MergeSettings.of(board, MERGE_TARGET), random),
    mergeScreen(figure, board),
    worldTone(3),
  );
}

// The shape of the origin cell of the board figure `figure` (issue #297), from the outline that
// the layout of the figure gives, as the board draws its cells (#296). The longer side
// of the box of the shape is `size` points. The origin cell has the values 0 and 0,
// and a triangle there points up. It reads only the layout, so it serves every figure.
export function originShape<TCoord>(figure: BoardFigure<TCoord>, size: number): CellShape {
  const origin = figure.geometry.createCoord([0, 0]);
  const { width, height } = cellBoxOf(figure.layoutOf(1), origin).shape;
  return cellBoxOf(figure.layoutOf(size / Math.max(width, height)), origin).shape;
}

// The board figure `id` with its geometry, its layout and its optional Fit level.
function boardFigure<TCoord>(
  id: TopologyId,
  geometry: GeometryFactory<TCoord>,
  layoutOf: (size: number) => BoardLayout<TCoord>,
  fitLevel?: FitLevel<TCoord>,
): BoardFigure<TCoord> {
  return { id, geometry, fitLevel, layoutOf };
}

// The Fit entry on the board figure `figure`, or no entry when the figure has no Fit level.
function fitOn<TCoord>(figure: BoardFigure<TCoord>, clock: Clock): RegisteredGame[] {
  const { fitLevel } = figure;
  if (fitLevel === undefined) return [];
  return [
    registered(
      GameId.of('hexa-fit'),
      new FitFactory(figure.geometry, fitLevel, clock),
      fitScreen(figure),
      worldTone(1),
      fitLevelVariant(figure.geometry, clock),
    ),
  ];
}

// The screen parts of Hexa Lines (#174, S3-07 proposed). The move mapper takes the step
// of the figure from a pressed space to the offset of the move (#405).
function linesScreen<TCoord>(
  figure: BoardFigure<TCoord>,
): ScreenParts<
  Color,
  TCoord,
  LinesView<TCoord>,
  LinesCellView,
  LinesPayloadView<TCoord>,
  PlacePiece<TCoord>,
  LinesIntent<TCoord>
> {
  return {
    mapper: new LinesStateMapper(),
    renderer: new LinesCellRenderer(),
    controls: new LinesControls(),
    moves: new LinesMoveMapper(figure.linesPlacementAt),
    layoutOf: (size) => figure.layoutOf(size),
  };
}

// The screen parts of Hexa Fit on the board figure `figure` (issue #175): its state mapper
// over the topology of the figure, its cell renderer, its move controls, its move mapper with
// the step of the figure from a pressed space to the offset of a place move (#365, #405)
// and the layout of the figure.
function fitScreen<TCoord>(
  figure: BoardFigure<TCoord>,
): ScreenParts<
  PieceId,
  TCoord,
  FitView<TCoord>,
  FitCellView,
  FitPayloadView<TCoord>,
  FitMove<TCoord>,
  FitIntent<TCoord>
> {
  return {
    mapper: new FitStateMapper(figure.geometry.createTopology()),
    renderer: new FitCellRenderer(),
    controls: new FitControls(),
    moves: new FitMoveMapper(figure.fitPlacementAt),
    layoutOf: (size) => figure.layoutOf(size),
  };
}

// The screen parts of Hexa Sort (#176). The stacks of the tray use the outline of the origin cell (#353).
function sortScreen<TCoord>(
  figure: BoardFigure<TCoord>,
): ScreenParts<
  ColorStack,
  TCoord,
  SortView,
  SortCellView,
  SortPayloadView,
  PlaceStack<TCoord>,
  SortIntent<TCoord>
> {
  return {
    mapper: new SortStateMapper(),
    renderer: new SortCellRenderer(),
    controls: new SortControls(originShape(figure, SORT_PREVIEW_SIZE)),
    moves: new SortMoveMapper(),
    layoutOf: (size) => figure.layoutOf(size),
  };
}

// The screen parts of Hexa Merge on the board figure `figure` (#177): `MergeStateMapper`,
// `MergeCellRenderer`, `MergeControls` with one way for each axis and sense of the topology
// of the figure, `MergeMoveMapper` with the slide of each way (#405), and the layout
// of the figure. The ways take the board region `board` of the Merge factory, so each way
// on the screen follows the lines of that board. The controls read only the compass name
// and the angle of each way.
function mergeScreen<TCoord>(
  figure: BoardFigure<TCoord>,
  board: RegionSize,
): ScreenParts<
  MergeTile,
  TCoord,
  MergeView,
  MergeCellView,
  MergePayloadView,
  Slide<GridAxis>,
  MergeIntent
> {
  const ways = slideWays(figure.geometry.createTopology(), board, figure.layoutOf(1));
  return {
    mapper: new MergeStateMapper(),
    renderer: new MergeCellRenderer(),
    controls: new MergeControls(ways),
    moves: new MergeMoveMapper(ways),
    layoutOf: (size) => figure.layoutOf(size),
  };
}

// The Fit level of the first content on the figure `topology` with the geometry `geometry`:
// three cells in a row and two pieces, a domino and a single cell.
// The cells (0, 0), (1, 0) and (2, 0) are a row on each figure (#354). On the triangle
// they point up, down and up, and the domino and the single cell start on an up triangle.
// It can be won: the domino covers the first two cells, and the single cell covers the third.
// On the triangle an offset counts lattice cells, so the offset (1, 0) moves
// the single cell to the third cell. The fewest moves are 2, so the third star can be won.
// A start with no level id starts this level. A start with a level id starts the bundled
// level of that id (#172).
function firstFitLevel<TCoord>(
  topology: TopologyId,
  geometry: GeometryFactory<TCoord>,
): FitLevel<TCoord> {
  const at = (col: number, row: number) => geometry.createCoord([col, row]);
  return FitLevel.of(
    topology,
    BoardShape.of([at(0, 0), at(1, 0), at(2, 0)]),
    [fitPiece('a', [at(0, 0), at(1, 0)]), fitPiece('b', [at(0, 0)])],
    [fitStar(8, 120_000), fitStar(4, 60_000), fitStar(2, 30_000)],
  );
}

// The thresholds of one Fit star: a move count and a time in milliseconds.
function fitStar(maxMoves: number, maxElapsedMs: number): FitStarThreshold {
  return FitStarThreshold.of({
    maxMoves: Moves.of(maxMoves),
    maxElapsedMs: ElapsedTime.ofMs(maxElapsedMs),
  });
}

// A Fit piece with the id `id` over the cells `cells`, relative to the origin of the piece.
function fitPiece<TCoord>(id: string, cells: readonly TCoord[]): Piece<PieceId, TCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), PieceId.of(id));
}

// The list as a list of one item or more. An empty list throws a RangeError.
function nonEmpty<T>(items: readonly T[]): readonly [T, ...T[]] {
  const [first, ...rest] = items;
  if (first === undefined) throw new RangeError('A game needs one item or more in each list.');
  return [first, ...rest];
}
