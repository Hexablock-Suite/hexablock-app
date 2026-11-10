import { TopologyId } from '../../../../src/domain/engine/geometry-factory';
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import type { Clock } from '../../../../src/domain/engine/clock';
import { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import type { IPieceSource } from '../../../../src/domain/engine/piece-source';
import { FitFactory } from '../../../../src/domain/variants/hexa-fit/fit-factory';
import { FitState, type FitSnapshot } from '../../../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { ManualClock } from '../../engine/manual-clock';
import { square, type SquareCoord } from '../../engine/square-topology';

// Hexa Fit test helpers. They exist only in test/.

export const A = PieceId.of('a');
export const B = PieceId.of('b');
export const C = PieceId.of('c');

// A level of two cells, (0, 0) and (1, 0), and one domino that covers them.
export function fitFactory(clock: Clock = new ManualClock()): FitFactory<SquareCoord> {
  const domino = new Piece(
    new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]),
    A,
  );
  return new FitFactory(
    new SquareGeometry(),
    {
      topology: TopologyId.square,
      figure: BoardShape.of([square(0, 0), square(1, 0)]),
      pieces: [domino],
    },
    clock,
  );
}

// A level of one row of six cells and three dominoes, so two placed dominoes do not win it.
export function threeDominoFitFactory(clock: Clock = new ManualClock()): FitFactory<SquareCoord> {
  const domino = (id: PieceId) =>
    new Piece(new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]), id);
  return new FitFactory(
    new SquareGeometry(),
    {
      topology: TopologyId.square,
      figure: BoardShape.of(Array.from({ length: 6 }, (_, col) => square(col, 0))),
      pieces: [domino(A), domino(B), domino(C)],
    },
    clock,
  );
}

// A live state built again from a photo, so a test can ask the rules about the state that a game
// shows. The engine never gives its state away. So the helper builds a new state with the ids,
// the board and the source of the photo, and the state takes the photo back with `restore()`.
// A Fit photo does not hold the pieces of the level, so `pieces` gives them,
// for example `fitFactory().createPieceSource()`.
export function fitStateOf<TCoord>(
  photo: FitSnapshot<TCoord>,
  pieces: IPieceSource<Piece<PieceId, TCoord>>,
): FitState<TCoord> {
  const state = FitState.start(photo.stateId, photo.matchId, photo.board.clone(), pieces);
  state.restore(photo);
  return state;
}
