import { SpaceStateMapper, type SpaceView } from '../adapters/space-state-mapper';
import { BoardShape } from '../domain/engine/board-shape';
import type { Clock } from '../domain/engine/clock';
import { Color } from '../domain/engine/color';
import { ElapsedTime } from '../domain/engine/elapsed-time';
import { GameId } from '../domain/engine/game-id';
import { TopologyId } from '../domain/engine/geometry-factory';
import { HexGeometry } from '../domain/engine/hex-geometry';
import { hex, type HexCoord } from '../domain/engine/hex-topology';
import { Moves } from '../domain/engine/moves';
import { Piece } from '../domain/engine/piece';
import type { RandomSource } from '../domain/engine/random-source';
import { RegionSize } from '../domain/engine/region-size';
import { Seed } from '../domain/engine/seed';
import { CellNode, ShapeGroup } from '../domain/engine/shape-node';
import { FitFactory } from '../domain/variants/hexa-fit/fit-factory';
import { FitLevel } from '../domain/variants/hexa-fit/fit-level';
import { FitStarThreshold } from '../domain/variants/hexa-fit/fit-stars';
import { PieceId } from '../domain/variants/hexa-fit/piece-id';
import { LinesFactory, LinesSettings } from '../domain/variants/hexa-lines/lines-factory';
import { MergeFactory, MergeSettings } from '../domain/variants/hexa-merge/merge-factory';
import { MergeTile } from '../domain/variants/hexa-merge/merge-tile';
import { GoalCount } from '../domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../domain/variants/hexa-sort/sort-level';
import { HexLayout } from './board/hex-layout';
import { SpaceCellRenderer } from './board/space-cell-renderer';
import { registered, type RegisteredGame, type ScreenParts } from './game-registry';

// The count of seeds: the unsigned 32-bit integers (classes.md decision 48).
const SEEDS = 2 ** 32;

// The hexagon of radius 4 of Hexa Lines (61 cells), and of radius 2 of Sort and Merge
// (19 cells), as docs/REQUIREMENTS.md §1 gives them. A hex region of size n has radius n - 1.
const LINES_BOARD = RegionSize.of(5);
const SMALL_BOARD = RegionSize.of(3);

// The tile that a Merge player tries to make, as in 2048 (A3).
const MERGE_TARGET = MergeTile.of(2048);

// The colors of the Lines pieces and of the Sort stacks. The statement gives no list.
const LINES_COLORS = [Color.of('red'), Color.of('blue'), Color.of('green'), Color.of('yellow')];
const SORT_COLORS = [Color.of('red'), Color.of('blue'), Color.of('green')];
const SORT_GOALS = GoalCount.of(3);

// The games of the registry, in the order of the game selector, on the hexagonal figure.
// The composition root calls the only module that names a variant factory: this one.
// Each entry names the `GameId` of its game next to its factory, and `registered()`
// checks the pair with `isFor()` (issue #234).
// Lines, Sort and Merge draw their seed from `random`, so each run of the app gets new pieces.
// Fit takes the clock for its level timer (classes.md decision 19).
// The Fit level and the Sort level are first content only: #172 lets the player choose
// a level from the level repository of #168, and `StartGame` then takes a port in place
// of the factory. APP-FR-16 lets the player choose the figure later.
// Each game shows its board with the default screen parts on the hexagon layout (#170).
// Each «Play … on the game screen» task (#174 to #177) gives its game the state mapper
// and the cell renderer of its variant in place of `hexScreen()`.
export function registeredGames(clock: Clock, random: RandomSource): RegisteredGame[] {
  const geometry = new HexGeometry();
  return [
    registered(
      GameId.of('hexa-lines'),
      new LinesFactory(
        geometry,
        LinesSettings.of(
          LINES_BOARD,
          seedFrom(random),
          nonEmpty(geometry.createPieceShapes()),
          nonEmpty(LINES_COLORS),
        ),
      ),
      hexScreen(),
    ),
    registered(
      GameId.of('hexa-fit'),
      new FitFactory(geometry, firstFitLevel(), clock),
      hexScreen(),
    ),
    registered(
      GameId.of('hexa-sort'),
      new SortFactory(
        geometry,
        SortLevel.seeded(SMALL_BOARD, SORT_GOALS, seedFrom(random), nonEmpty(SORT_COLORS)),
      ),
      hexScreen(),
    ),
    registered(
      GameId.of('hexa-merge'),
      new MergeFactory(geometry, MergeSettings.of(SMALL_BOARD, seedFrom(random), MERGE_TARGET)),
      hexScreen(),
    ),
  ];
}

// The default screen parts on the hexagon figure: the mapper and the renderer that tell
// a free space from an occupied one, and the layout of the hexagon (D4, issue #165).
function hexScreen(): ScreenParts<unknown, HexCoord, unknown, SpaceView, undefined> {
  return {
    mapper: new SpaceStateMapper(),
    renderer: new SpaceCellRenderer(),
    layoutOf: (size) => new HexLayout(size),
  };
}

// One seed from the next draw of `random`: a whole number of 0 to 4294967295.
// The draw keeps its number private, so it delivers the number to this module of the edge
// (rule R-no-delivery-call, issue #243).
function seedFrom(random: RandomSource): Seed {
  let seed: Seed | undefined;
  random.next().deliverTo({
    receive: (draw) => {
      seed = Seed.of(Math.floor(draw * SEEDS));
    },
  });
  if (seed === undefined) throw new Error('The draw delivered no number.');
  return seed;
}

// A Fit level of three cells in a row and two pieces, a domino and a single cell.
// It can be won: the domino covers the first two cells, and the single cell covers the third.
// The fewest moves are 2, so the third star can be won.
// #172 starts the bundled levels by their id, in place of this level.
function firstFitLevel(): FitLevel<HexCoord> {
  return FitLevel.of(
    TopologyId.hex,
    BoardShape.of([hex(0, 0), hex(1, 0), hex(2, 0)]),
    [fitPiece('a', [hex(0, 0), hex(1, 0)]), fitPiece('b', [hex(0, 0)])],
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
function fitPiece(id: string, cells: readonly HexCoord[]): Piece<PieceId, HexCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), PieceId.of(id));
}

// The list as a list of one item or more. An empty list throws a RangeError.
function nonEmpty<T>(items: readonly T[]): readonly [T, ...T[]] {
  const [first, ...rest] = items;
  if (first === undefined) throw new RangeError('A game needs one item or more in each list.');
  return [first, ...rest];
}
