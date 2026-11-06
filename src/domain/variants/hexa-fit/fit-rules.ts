import type { Outcome } from '../../engine/outcome';
import { Resolution } from '../../engine/resolution';
import { BaseGameRules } from '../../engine/rules';
import { Turns } from '../../engine/turns';
import { PlaceFitPiece, RemoveFitPiece, RotateFitPiece, type FitMove } from './fit-move';
import type { FitState } from './fit-state';
import type { PieceId } from './piece-id';
import { Placement } from './placement';

// The rules of Hexa Fit (REQUIREMENTS.md §1, statement §1.2).
// A piece fits only on free cells of the figure. A rotation counts steps of the topology (A5).
// Fit has no resolution step. The game is won when the pieces cover the figure exactly,
// and it has no defeat: `evaluate()` never returns `game-over`.
// The rules stay generic over `TCoord`, so they run on any topology (classes.md decision 16).
export class FitRules<TCoord> extends BaseGameRules<FitMove<TCoord>, FitState<TCoord>> {
  isValid(state: FitState<TCoord>, move: FitMove<TCoord>): boolean {
    switch (move.kind) {
      case 'place':
        return (
          state.placementOf(move.pieceId) === undefined &&
          fits(state, move.pieceId, Placement.of(move.rotation, move.at, state.board.topology))
        );
      case 'remove':
        return state.placementOf(move.pieceId) !== undefined;
      case 'rotate': {
        const placement = state.placementOf(move.pieceId);
        return (
          placement !== undefined &&
          fits(state, move.pieceId, placement.turned(move.steps, state.board.topology))
        );
      }
      default:
        return unknownMove(move);
    }
  }

  // Remove and rotate moves of the placed pieces first, then the place moves of the tray.
  // A place move takes each figure cell as its offset. That covers every placement when
  // the topology adds coordinates and each piece holds its origin, as on hexagons and squares.
  *validMoves(state: FitState<TCoord>): Iterable<FitMove<TCoord>> {
    const { topology } = state.board;
    for (const id of state.placed()) {
      yield new RemoveFitPiece(id);
      for (let step = 1; step < topology.rotationSteps; step += 1) {
        const move = new RotateFitPiece(id, Turns.of(step));
        if (this.isValid(state, move)) yield move;
      }
    }
    for (const piece of state.remaining()) {
      for (let step = 0; step < topology.rotationSteps; step += 1) {
        for (const at of state.board.shape.cells) {
          const move = new PlaceFitPiece(piece.content, Turns.of(step), at);
          if (this.isValid(state, move)) yield move;
        }
      }
    }
  }

  apply(state: FitState<TCoord>, move: FitMove<TCoord>): FitState<TCoord> {
    const { topology } = state.board;
    switch (move.kind) {
      case 'place':
        return state.place(move.pieceId, Placement.of(move.rotation, move.at, topology));
      case 'remove':
        return state.remove(move.pieceId);
      case 'rotate': {
        const placement = state.placementOf(move.pieceId);
        if (placement === undefined) {
          throw new RangeError(`The piece ${move.pieceId.value} is not on the figure.`);
        }
        return state
          .remove(move.pieceId)
          .place(move.pieceId, placement.turned(move.steps, topology));
      }
      default:
        return unknownMove(move);
    }
  }

  // Fit has no resolution: the move only places, removes or turns a piece.
  resolve(state: FitState<TCoord>): Resolution<FitState<TCoord>> {
    return Resolution.resolved(state);
  }

  // A piece goes only on free figure cells, so a full figure is an exact cover.
  evaluate(state: FitState<TCoord>): Outcome {
    const { board } = state;
    return board.cells().length === board.shape.cells.length ? 'victory' : 'playing';
  }
}

// True when every cell of the placed piece lies inside the figure and is free or
// already holds this piece. The second case lets a placed piece turn over its own cells.
function fits<TCoord>(state: FitState<TCoord>, id: PieceId, placement: Placement<TCoord>): boolean {
  const piece = state.piece(id);
  if (piece === undefined) return false;
  return placement.cells(piece, state.board.topology).every((c) => {
    if (!state.board.contains(c)) return false;
    const cell = state.board.get(c);
    return cell === undefined || cell.equals(id);
  });
}

// A value outside the `FitMove` union reaches this function only through a cast.
function unknownMove(move: never): never {
  throw new RangeError(`Unknown Fit move: ${String((move as { kind?: unknown }).kind)}.`);
}
