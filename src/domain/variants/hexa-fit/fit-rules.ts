import type { ReadonlyBoard } from '../../engine/board';
import { Outcome } from '../../engine/outcome';
import { Resolution } from '../../engine/resolution';
import { BaseGameRules } from '../../engine/rules';
import { Turns } from '../../engine/turns';
import { PlaceFitPiece, RemoveFitPiece, RotateFitPiece, type FitMove } from './fit-move';
import type { FitSnapshot, FitState } from './fit-state';
import type { PieceId } from './piece-id';
import type { Placement } from './placement';

const NO_TURN = Turns.of(0);

// The rules of Hexa Fit (REQUIREMENTS.md §1, statement §1.2).
// A piece fits only on free cells of the figure. A rotation counts steps of the topology (A5).
// Fit has no resolution step. The game is won when the pieces cover the figure exactly,
// and it has no defeat: `evaluate()` never returns `game-over`.
// Each accepted move adds one to `FitState.moves`: place, rotate and remove (issue #60).
// `playTurn()` applies only a valid move, so a rejected move counts nothing.
// The rules stay generic over `TCoord`, so they run on any topology (classes.md decision 16).
// The rules read the board through the photo of the state, and they ask the state
// `piece()`, `placementOf()`, `placed()` and `remaining()`.
// The rules read no field of a move (classes.md decision 43). The class of the move tells
// its kind, and the rules ask the move for its piece and for the placement that it gives.
export class FitRules<TCoord> extends BaseGameRules<FitMove<TCoord>, FitState<TCoord>> {
  isValid(state: FitState<TCoord>, move: FitMove<TCoord>): boolean {
    return isValidOn(state, state.snapshot(), move);
  }

  // Remove and rotate moves of the placed pieces first, then the place moves of the tray.
  // A place move takes each figure cell as its offset. That covers every placement when
  // the topology adds coordinates and each piece holds its origin, as on hexagons and squares.
  // The generator takes one photo, and every check of a move reads it.
  *validMoves(state: FitState<TCoord>): Iterable<FitMove<TCoord>> {
    const photo = state.snapshot();
    const { topology } = photo.board;
    for (const id of state.placed()) {
      yield new RemoveFitPiece(id);
      for (const steps of topology.fullTurn().shorter()) {
        const move = new RotateFitPiece(id, steps);
        // A rotation of no step changes nothing, so it is not a move.
        if (!steps.equals(NO_TURN) && isValidOn(state, photo, move)) yield move;
      }
    }
    for (const piece of state.remaining()) {
      for (const rotation of topology.fullTurn().shorter()) {
        for (const at of photo.board.shape.cells) {
          const move = new PlaceFitPiece(piece.content, rotation, at);
          if (isValidOn(state, photo, move)) yield move;
        }
      }
    }
  }

  // The move changes the state in place, and the rules return the same state object.
  apply(state: FitState<TCoord>, move: FitMove<TCoord>): FitState<TCoord> {
    changeBy(state, move);
    state.countMove();
    return state;
  }

  // Fit has no resolution: the move only places, removes or turns a piece.
  resolve(_state: FitState<TCoord>): Resolution {
    return Resolution.resolved();
  }

  // A piece goes only on free figure cells, so a full figure is an exact cover.
  evaluate(state: FitState<TCoord>): Outcome {
    const { board } = state.snapshot();
    return board.cells().length === board.shape.cells.length ? Outcome.victory : Outcome.playing;
  }
}

// Whether the move is valid on the state that `photo` shows now.
function isValidOn<TCoord>(
  state: FitState<TCoord>,
  photo: FitSnapshot<TCoord>,
  move: FitMove<TCoord>,
): boolean {
  const { board } = photo;
  if (move instanceof PlaceFitPiece) {
    return (
      state.placementOf(move.piece()) === undefined &&
      fits(state, board, move.piece(), move.placement(board.topology))
    );
  }
  if (move instanceof RemoveFitPiece) return state.placementOf(move.piece()) !== undefined;
  if (move instanceof RotateFitPiece) {
    const placement = state.placementOf(move.piece());
    return (
      placement !== undefined &&
      fits(state, board, move.piece(), move.turn(placement, board.topology))
    );
  }
  return unknownMove(move);
}

// Changes the state by the move, before the rules count it.
// A rotation removes the piece and places it again, turned.
function changeBy<TCoord>(state: FitState<TCoord>, move: FitMove<TCoord>): void {
  const { topology } = state.snapshot().board;
  if (move instanceof PlaceFitPiece) {
    state.place(move.piece(), move.placement(topology));
    return;
  }
  if (move instanceof RemoveFitPiece) {
    state.remove(move.piece());
    return;
  }
  if (move instanceof RotateFitPiece) {
    const placement = state.placementOf(move.piece());
    if (placement === undefined) {
      throw new RangeError(`The piece ${move.piece().value} is not on the figure.`);
    }
    state.remove(move.piece());
    state.place(move.piece(), move.turn(placement, topology));
    return;
  }
  unknownMove(move);
}

// True when every cell of the placed piece lies inside the figure and is free or
// already holds this piece. The second case lets a placed piece turn over its own cells.
function fits<TCoord>(
  state: FitState<TCoord>,
  board: ReadonlyBoard<PieceId, TCoord>,
  id: PieceId,
  placement: Placement<TCoord>,
): boolean {
  const piece = state.piece(id);
  if (piece === undefined) return false;
  return placement.cells(piece, board.topology).every((c) => {
    if (!board.contains(c)) return false;
    const cell = board.get(c);
    return cell === undefined || cell.equals(id);
  });
}

// A value outside the `FitMove` union reaches this function only through a cast.
// It is an object of no move class, so the message names the `kind` text that it carries.
function unknownMove(move: never): never {
  throw new RangeError(`Unknown Fit move: ${String((move as { kind?: unknown }).kind)}.`);
}
