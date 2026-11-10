import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { FitFactory } from '../../../../src/domain/variants/hexa-fit/fit-factory';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { square, type SquareCoord } from '../../engine/square-topology';

// Hexa Fit test helpers. They exist only in test/.

export const A = PieceId.of('a');

// A level of two cells, (0, 0) and (1, 0), and one domino that covers them.
export function fitFactory(): FitFactory<SquareCoord> {
  const domino = new Piece(
    new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]),
    A,
  );
  return new FitFactory(new SquareGeometry(), {
    topology: 'square',
    figure: BoardShape.of([square(0, 0), square(1, 0)]),
    pieces: [domino],
  });
}
