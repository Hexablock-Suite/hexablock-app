import { Score } from '../../../../src/domain/engine/score';
import { Board } from '../../../../src/domain/engine/board';
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { Color } from '../../../../src/domain/engine/color';
import type { CoordKey } from '../../../../src/domain/engine/coord-key';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/engine/game-id';
import type { GameStateId } from '../../../../src/domain/engine/game-state-id';
import type { MatchId } from '../../../../src/domain/engine/match-id';
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
import { PlaceStack } from '../../../../src/domain/variants/hexa-sort/place-stack';
import { SortState, type SortSnapshot } from '../../../../src/domain/variants/hexa-sort/sort-state';
import { RecordingPublisher } from '../../engine/fake-game';
import { square, squareTopology, type SquareCoord } from '../../engine/square-topology';
import { MATCH_ID } from '../../engine/match-id';
import { BOARD_ID, STATE_ID } from '../../engine/entity-ids';

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

// The color names that the Sort tests use.
const PALETTE = ['red', 'blue', 'green', 'yellow'];

// The color names of a stack, from the bottom to the top. No stack gives `[]`.
// `ColorStack` and `Color` keep their fields private, so the helper reads the stack
// through its operations: it names the top color with `equals()` and removes the top run.
export function names(content: ColorStack | undefined): string[] {
  const found: string[] = [];
  for (let rest = content; rest?.isEmpty() === false; rest = rest.withoutTopRun()) {
    const run = rest.topRun();
    const name = PALETTE.find((candidate) => run[0]?.equals(Color.of(candidate)) === true);
    if (name === undefined) throw new Error(`The stack has a color outside ${PALETTE.join(', ')}.`);
    found.unshift(...run.map(() => name));
  }
  return found;
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
): Board<ColorStack, SquareCoord> {
  const shape = BoardShape.of(Array.from({ length }, (_, col) => square(col, 0)));
  const cells = new Map<CoordKey, [SquareCoord, ColorStack]>(
    content.map(([at, cell]) => [squareTopology.key(at), [at, cell]]),
  );
  return new Board(BOARD_ID, shape, squareTopology, cells);
}

// No points: the rules tests check the board, not the score.
export class NoScoring implements IScoringPolicy<SortState<SquareCoord>> {
  score(): Score {
    return Score.of(0);
  }
}

// `goalsNeeded` is a number, and the helper wraps it in a `GoalCount`, so 0 throws.
export function sortState(values: {
  board: Board<ColorStack, SquareCoord>;
  offered?: readonly ColorStack[];
  source?: IPieceSource<Piece<ColorStack, SquareCoord>>;
  goalsNeeded?: number;
  matchId?: MatchId;
  stateId?: GameStateId;
}): SortState<SquareCoord> {
  return SortState.start({
    stateId: values.stateId ?? STATE_ID,
    matchId: values.matchId ?? MATCH_ID,
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
    MATCH_ID,
    GameId.of('hexa-sort'),
    new SortRules<SquareCoord>(),
    scoring,
    new RecordingPublisher(),
  );
  engine.start(state);
  return engine;
}

export function place(col: number, row = 0): PlaceStack<SquareCoord> {
  return PlaceStack.on(square(col, row));
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

// A live state built again from a photo, so a test can ask the rules about the state that a game
// shows. The engine never gives its state away. So the helper builds a new state with the ids,
// the board and the source of the photo, and the state takes the photo back with `restore()`.
export function sortStateOf<TCoord>(photo: SortSnapshot<TCoord>): SortState<TCoord> {
  const state = SortState.start({
    stateId: photo.stateId,
    matchId: photo.matchId,
    board: photo.board.clone(),
    source: photo.source.clone(),
    goalsNeeded: photo.goalsNeeded,
  });
  state.restore(photo);
  return state;
}
