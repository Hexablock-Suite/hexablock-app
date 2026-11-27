import type { GridTopology } from '../domain/engine/grid-topology';
import type { Moves } from '../domain/shared/moves';
import type { Piece } from '../domain/engine/piece';
import type { FitView } from '../domain/variants/hexa-fit/fit-state';
import type { PieceId } from '../domain/variants/hexa-fit/piece-id';
import type { StateMapper } from './state-mapper';

// The cell view of Hexa Fit: the text id of the piece that covers the space.
// A free space of the figure has no piece.
export interface FitCellView {
  readonly piece?: string;
}

// One piece of the Fit tray: the text id of the piece and the cells of the piece after each
// rotation step of the topology, from no step up to one step short of the full turn.
// The cells are relative to the origin of the piece. A piece only turns: it never mirrors (C7).
export interface FitTrayPiece<TCoord> {
  readonly piece: string;
  readonly turns: readonly (readonly TCoord[])[];
}

// The payload view of the Fit screen: the pieces of the tray, the text ids of the pieces
// on the figure and the count of the accepted moves.
export interface FitPayloadView<TCoord> {
  readonly tray: readonly FitTrayPiece<TCoord>[];
  readonly placed: readonly string[];
  readonly moves: number;
}

const FREE: FitCellView = Object.freeze({});

// The state mapper of Hexa Fit (classes.md decision 14, issue #175). The game registry of the
// composition root pairs it with `FitCellRenderer`, so both name `FitCellView`.
// It is an adapter of the edge, so it receives the text of a `PieceId`, the data of the
// `FitView` and the number of the `Moves` with `deliverTo()` (rule R-no-delivery-call).
// It repeats no rule of the game: the state gives the tray, the placed pieces and the move
// count, and the topology of the figure turns each tray piece. So the screen shows each rotation
// that a place move can take, and it calculates no coordinate.
export class FitStateMapper<TCoord> implements StateMapper<
  PieceId,
  FitView<TCoord>,
  FitCellView,
  FitPayloadView<TCoord>
> {
  constructor(private readonly topology: GridTopology<TCoord>) {}

  toView(cell: PieceId): FitCellView {
    return { piece: textOf(cell) };
  }

  freeView(): FitCellView {
    return FREE;
  }

  // A view that delivers no data throws an Error.
  toPayload(payload: FitView<TCoord>): FitPayloadView<TCoord> {
    let view: FitPayloadView<TCoord> | undefined;
    payload.deliverTo({
      receive: (remaining, placed, moves) => {
        view = {
          tray: remaining.map((piece) => this.trayPiece(piece)),
          placed: placed.map(textOf),
          moves: countOf(moves),
        };
      },
    });
    if (view === undefined) throw new Error('The Fit view delivered no data.');
    return view;
  }

  // The tray piece at each rotation step of the topology.
  private trayPiece(piece: Piece<PieceId, TCoord>): FitTrayPiece<TCoord> {
    const turns = [...this.topology.fullTurn().shorter()];
    return {
      piece: textOf(piece.occupant()),
      turns: turns.map((steps) => piece.rotated(steps, this.topology).coveredCoordinates()),
    };
  }
}

// The text of a piece id.
function textOf(id: PieceId): string {
  let text = '';
  id.deliverTo({
    receive: (value) => {
      text = value;
    },
  });
  return text;
}

// The number of a move count.
function countOf(moves: Moves): number {
  let count = 0;
  moves.deliverTo({
    receive: (value) => {
      count = value;
    },
  });
  return count;
}
