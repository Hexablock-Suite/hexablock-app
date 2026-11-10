import { Board } from '../../../../src/domain/engine/board';
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { Color } from '../../../../src/domain/engine/color';
import type { CoordKey } from '../../../../src/domain/engine/coord-key';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import { Piece } from '../../../../src/domain/engine/piece';
import {
  FixedListPieceSource,
  type IPieceSource,
} from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { CellNode } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { ColorStack } from '../../../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import { SortRules } from '../../../../src/domain/variants/hexa-sort/sort-rules';
import { SortState, type PlaceStack } from '../../../../src/domain/variants/hexa-sort/sort-state';
import { RecordingPublisher } from '../../engine/fake-game';
import { square, squareTopology, type SquareCoord } from '../../engine/square-topology';

// Hexa Sort test helpers. The board uses the square topology double (D4), so the tests
// prove that the Sort rules ask the topology for the neighbors and assume no hexagon.

export type SortGame = GameEngine<
  ColorStack,
  SquareCoord,
  PlaceStack<SquareCoord>,
  SortState<SquareCoord>
>;

// A stack of tiles from the bottom to the top. Each name becomes an engine `Color`,
// so an empty name throws a RangeError.
export function stack(...names: string[]): ColorStack {
  return ColorStack.of(names.map((name) => Color.of(name)));
}

// The color names of a stack, from the bottom to the top. No stack gives `[]`.
export function names(content: ColorStack | undefined): string[] {
  return content?.chips.map((chip) => chip.name) ?? [];
}

// `count` tiles of one color, by name.
export function tiles(name: string, count: number): string[] {
  return Array.from({ length: count }, () => name);
}

// A Sort piece is one cell with a stack (classes.md decision 6).
export function stackPiece(content: ColorStack): Piece<ColorStack, SquareCoord> {
  return new Piece(new CellNode(square(0, 0)), content);
}

// A board of one row of `length` cells, (0, 0) to (length - 1, 0).
// The board keeps `content` in the order of the list, so `board.cells()` keeps it too.
export function row(
  length: number,
  content: readonly [SquareCoord, ColorStack][] = [],
): Board<ColorStack, SquareCoord, string> {
  const shape = BoardShape.of(Array.from({ length }, (_, col) => square(col, 0)));
  const cells = new Map<CoordKey, [SquareCoord, ColorStack]>(
    content.map(([at, cell]) => [squareTopology.key(at), [at, cell]]),
  );
  return new Board(shape, squareTopology, cells);
}

// No points: the rules tests check the board, not the score.
export class NoScoring implements IScoringPolicy<SortState<SquareCoord>> {
  score(): number {
    return 0;
  }
}

// `goalsNeeded` is a number, and the helper wraps it in a `GoalCount`, so 0 throws.
export function sortState(values: {
  board: Board<ColorStack, SquareCoord, string>;
  offered?: readonly ColorStack[];
  source?: IPieceSource<Piece<ColorStack, SquareCoord>>;
  goalsNeeded?: number;
}): SortState<SquareCoord> {
  return SortState.start({
    board: values.board,
    source: values.source ?? new FixedListPieceSource((values.offered ?? []).map(stackPiece)),
    goalsNeeded: GoalCount.of(values.goalsNeeded ?? 5),
  });
}

// A started game whose engine calls only the rules contract and the given scoring.
export function sortGame(
  state: SortState<SquareCoord>,
  scoring: IScoringPolicy<SortState<SquareCoord>> = new NoScoring(),
): SortGame {
  const engine: SortGame = new GameEngine(
    GameId.of('hexa-sort'),
    new SortRules<SquareCoord>(),
    scoring,
    new RecordingPublisher(),
  );
  engine.start(state);
  return engine;
}

export function place(col: number, row = 0): PlaceStack<SquareCoord> {
  return { at: square(col, row) };
}

// The color names of the cell `(col, row)`, from the bottom to the top.
// An empty cell gives `[]`.
export function chipsAt(game: SortGame, col: number, row = 0): string[] {
  return names(game.snapshot().board.get(square(col, row)));
}

// A Sort factory on a 2 × 2 square board. The level offers `offered` from a fixed list.
// The helper wraps `goalsNeeded` in a `GoalCount`, so 0 throws.
export function sortFactory(
  offered: readonly ColorStack[] = [stack('red'), stack('blue')],
  goalsNeeded = 5,
): SortFactory<SquareCoord> {
  return new SortFactory(new SquareGeometry(), {
    size: RegionSize.of(2),
    source: new FixedListPieceSource(offered.map(stackPiece)),
    goalsNeeded: GoalCount.of(goalsNeeded),
  });
}
