import { Score } from '../../../../src/domain/shared/score';
import { Board, type ReadonlyBoard } from '../../../../src/domain/engine/board';
import { GameEngine } from '../../../../src/domain/engine/game-engine';
import { GameId } from '../../../../src/domain/shared/game-id';
import { GameStateId } from '../../../../src/domain/engine/game-state-id';
import type { MatchId } from '../../../../src/domain/engine/match-id';
import type { GridTopology } from '../../../../src/domain/engine/grid-topology';
import { Piece } from '../../../../src/domain/engine/piece';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { CellNode, ShapeGroup, type ShapeNode } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { Color } from '../../../../src/domain/engine/color';
import {
  LinesFactory,
  LinesSettings,
} from '../../../../src/domain/variants/hexa-lines/lines-factory';
import { LinesRules } from '../../../../src/domain/variants/hexa-lines/lines-rules';
import {
  LinesState,
  type LinesSnapshot,
} from '../../../../src/domain/variants/hexa-lines/lines-state';
import type { CellCount } from '../../../../src/domain/variants/hexa-lines/cell-count';
import type { LineCount } from '../../../../src/domain/variants/hexa-lines/line-count';
import type { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import type { Streak } from '../../../../src/domain/variants/hexa-lines/streak';
import { square, type SquareCoord } from '../../engine/square-topology';
import { MATCH_ID } from '../../engine/match-id';
import { BOARD_ID, STATE_ID } from '../../engine/entity-ids';
import { boardLike } from '../../engine/variant-game';
import { delivered } from '../../engine/value-receiver';
import { seededRandom } from '../../engine/step-random';

// Builders for the Hexa Lines rules tests. They exist only in test/.

export const red = Color.of('red');
export const blue = Color.of('blue');

// A piece of the given cells. The cells are relative to the origin of the piece.
export function piece<TCoord>(...cells: TCoord[]): Piece<Color, TCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), red);
}

// A region of the topology with `filled` cells, the tray and the pieces left in the source.
// `cellsPlaced`, `linesCleared` and `streak` give the facts of the last placement.
// The photo keeps them private (issue #245), so a scoring test builds a state with the facts
// and takes its photo.
export function linesState<TCoord>(
  topology: GridTopology<TCoord>,
  size: number,
  values: {
    filled?: readonly TCoord[];
    tray: Piece<Color, TCoord>[];
    source?: readonly Piece<Color, TCoord>[];
    matchId?: MatchId;
    stateId?: GameStateId;
    cellsPlaced?: CellCount;
    linesCleared?: LineCount;
    streak?: Streak;
  },
): LinesState<TCoord> {
  const board = new Board<Color, TCoord>(BOARD_ID, topology.region(RegionSize.of(size)), topology);
  for (const c of values.filled ?? []) board.occupy(c, red);
  return new LinesState(
    values.stateId ?? STATE_ID,
    values.matchId ?? MATCH_ID,
    board,
    values.tray,
    new FixedListPieceSource(values.source ?? []),
    values.streak,
    values.linesCleared,
    values.cellsPlaced,
  );
}

// The rules tests give no points. The scoring tests pass their own policy.
class NoScoring<TCoord> implements IScoringPolicy<LinesState<TCoord>> {
  score(): Score {
    return Score.of(0);
  }
}

// A started Lines game on the real engine. The engine calls only the rules contract.
export function linesGame<TCoord>(
  initial: LinesState<TCoord>,
  scoring: IScoringPolicy<LinesState<TCoord>> = new NoScoring<TCoord>(),
) {
  const engine = new GameEngine<Color, TCoord, PlacePiece<TCoord>, LinesState<TCoord>>(
    MATCH_ID,
    GameId.of('hexa-lines'),
    new LinesRules<TCoord>(),
    scoring,
  );
  engine.start(initial);
  return { engine };
}

// The keys of the filled cells, sorted, so a test compares boards by value.
// It takes a photo, because only the photo shows the board of a state.
export function filledKeys<TCoord>(photo: { boardCopy(): ReadonlyBoard<Color, TCoord> }): string[] {
  const board = photo.boardCopy();
  return board
    .occupiedCells()
    .map(([c]) => delivered(board.key(c)))
    .sort();
}

// A Lines factory on a 3 × 3 square board. By default each piece is one red cell.
// Each match of the factory starts from the seed `seed` (issue #417).
export function linesFactory(
  seed = 1,
  shapes: readonly [ShapeNode<SquareCoord>, ...ShapeNode<SquareCoord>[]] = [
    new CellNode(square(0, 0)),
  ],
  colors: readonly [Color, ...Color[]] = [red],
): LinesFactory<SquareCoord> {
  return new LinesFactory(
    new SquareGeometry(),
    LinesSettings.of(RegionSize.of(3), shapes, colors),
    seededRandom(seed),
  );
}

// A live state built again from a photo, so a test can ask the rules about the state that a game
// shows. The engine never gives its state away. So the helper builds a new state of the match
// `matchId` with the source of the photo and a new square board of the same shape, and the state
// takes the photo back with `restore()`. The photo hands out no board (issue #234), and it keeps
// its ids private (issue #245): the ids of the state and of the board come from `matchId`.
export function linesStateOf(
  photo: LinesSnapshot<SquareCoord>,
  matchId: MatchId = MATCH_ID,
): LinesState<SquareCoord> {
  const board = boardLike(photo.boardCopy(), new SquareGeometry(), matchId);
  const state = new LinesState(GameStateId.of(matchId), matchId, board, [], photo.pieceSource());
  state.restore(photo);
  return state;
}
