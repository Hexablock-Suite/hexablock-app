import { TopologyId } from '../../../../src/domain/engine/geometry-factory';
import { GameStateId } from '../../../../src/domain/engine/game-state-id';
import type { MatchId } from '../../../../src/domain/engine/match-id';
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import type { Clock } from '../../../../src/domain/engine/clock';
import { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import type { IPieceSource } from '../../../../src/domain/engine/piece-source';
import { FitFactory } from '../../../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevel } from '../../../../src/domain/variants/hexa-fit/fit-level';
import { FitState, type FitSnapshot } from '../../../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { ManualClock } from '../../engine/manual-clock';
import { MATCH_ID } from '../../engine/match-id';
import { square, type SquareCoord } from '../../engine/square-topology';
import { boardLike } from '../../engine/variant-game';

// Hexa Fit test helpers. They exist only in test/.

export const A = PieceId.of('a');
export const B = PieceId.of('b');
export const C = PieceId.of('c');

// A level of two cells, (0, 0) and (1, 0), and one domino that covers them.
// The timer of each game takes the id of its match (issue #236).
export function fitFactory(clock: Clock = new ManualClock()): FitFactory<SquareCoord> {
  const domino = new Piece(
    new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]),
    A,
  );
  return new FitFactory(
    new SquareGeometry(),
    FitLevel.of(TopologyId.square, BoardShape.of([square(0, 0), square(1, 0)]), [domino], []),
    clock,
  );
}

// A level of one row of six cells and three dominoes, so two placed dominoes do not win it.
export function threeDominoFitFactory(clock: Clock = new ManualClock()): FitFactory<SquareCoord> {
  const domino = (id: PieceId) =>
    new Piece(new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]), id);
  return new FitFactory(
    new SquareGeometry(),
    FitLevel.of(
      TopologyId.square,
      BoardShape.of(Array.from({ length: 6 }, (_, col) => square(col, 0))),
      [domino(A), domino(B), domino(C)],
      [],
    ),
    clock,
  );
}

// A live state built again from a photo, so a test can ask the rules about the state that a game
// shows. The engine never gives its state away. So the helper builds a new state of the match
// `matchId` and a new square board of the same shape, and the state takes the photo back
// with `restore()`. The photo hands out no board (issue #234), and it keeps its ids private
// (issue #245): the ids of the state and of the board come from `matchId`.
// A Fit photo does not hold the pieces of the level, so `pieces` gives them,
// for example `fitFactory().createPieceSource()`.
export function fitStateOf(
  photo: FitSnapshot<SquareCoord>,
  pieces: IPieceSource<Piece<PieceId, SquareCoord>>,
  matchId: MatchId = MATCH_ID,
): FitState<SquareCoord> {
  const board = boardLike(photo.boardCopy(), new SquareGeometry(), matchId);
  const state = FitState.start(GameStateId.of(matchId), matchId, board, pieces);
  state.restore(photo);
  return state;
}
