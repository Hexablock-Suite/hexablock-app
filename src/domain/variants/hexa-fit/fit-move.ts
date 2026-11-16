import type { ReadonlyBoard } from '../../engine/board';
import type { CoordKey } from '../../engine/coord-key';
import type { Turns } from '../../engine/turns';
import type { FitSnapshot, FitState } from './fit-state';
import type { PieceId } from './piece-id';
import { Placement } from './placement';

// The moves of Hexa Fit: place, remove or rotate a piece (REQUIREMENTS.md §1).
// `FitMove` is a closed union of three classes.
// Each move is a value object (classes.md decision 43): it never changes, its fields are
// private, and two moves are equal when they are of the same class and hold the same parts.
// Each move holds its own check and its own change (issue #244). `isValidOn()` tells whether
// the move is valid on a state and its photo, and `applyTo()` changes the state.
// `FitRules` calls these two operations, so no code tells the moves apart by their class.
// A move asks the photo of the state for its board. It changes the state only through
// the business methods `place()` and `remove()` of `FitState`.
// Each class names its piece with a query that says what the move does with it:
// `pieceToPlace()`, `pieceToRemove()` and `pieceToRotate()` (issue #234).
// A rotation counts steps of the topology, never degrees (A5, D4).

// Puts a tray piece on the figure. The piece turns by `rotation` around its own origin,
// and then moves by the offset `at`.
export class PlaceFitPiece<TCoord> {
  constructor(
    private readonly pieceId: PieceId,
    private readonly rotation: Turns,
    private readonly at: TCoord,
  ) {}

  // The piece that this move puts on the figure.
  pieceToPlace(): PieceId {
    return this.pieceId;
  }

  // Where this move puts the piece: its rotation and its offset.
  // A topology or a board gives the full turn that shortens the rotation.
  placement(topology: { fullTurn(): Turns }): Placement<TCoord> {
    return Placement.of(this.rotation, this.at, topology);
  }

  // True when the piece is in the tray and its placement fits on free figure cells.
  isValidOn(state: FitState<TCoord>, photo: FitSnapshot<TCoord>): boolean {
    const board = photo.boardCopy();
    return (
      state.placementOf(this.pieceId) === undefined &&
      fits(state, board, this.pieceId, this.placement(board))
    );
  }

  // Puts the piece on the cells of its placement.
  applyTo(state: FitState<TCoord>): void {
    const board = state.snapshot().boardCopy();
    state.place(this.pieceId, this.placement(board));
  }

  // Two place moves are equal when they have the same piece, the same rotation count
  // and the same offset. The move compares the counts as the player gave them.
  // The topology compares the offsets, because `TCoord` has no bound (classes.md decision 16).
  equals(other: FitMove<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return (
      isOfClassOf(this, other) &&
      this.pieceId.equals(other.pieceId) &&
      this.rotation.equals(other.rotation) &&
      topology.key(this.at) === topology.key(other.at)
    );
  }
}

// Takes a placed piece back to the tray.
export class RemoveFitPiece {
  constructor(private readonly pieceId: PieceId) {}

  // The piece that this move takes off the figure.
  pieceToRemove(): PieceId {
    return this.pieceId;
  }

  // True when the piece is on the figure. The move needs no cell of the photo.
  isValidOn<TCoord>(state: FitState<TCoord>, _photo: FitSnapshot<TCoord>): boolean {
    return state.placementOf(this.pieceId) !== undefined;
  }

  // Takes the piece off the figure.
  applyTo<TCoord>(state: FitState<TCoord>): void {
    state.remove(this.pieceId);
  }

  // Two remove moves are equal when they name the same piece.
  equals(other: FitMove<unknown>): boolean {
    return isOfClassOf(this, other) && this.pieceId.equals(other.pieceId);
  }
}

// Turns a placed piece by `steps` around its own origin. The offset of the piece stays.
export class RotateFitPiece {
  constructor(
    private readonly pieceId: PieceId,
    private readonly steps: Turns,
  ) {}

  // The piece that this move turns.
  pieceToRotate(): PieceId {
    return this.pieceId;
  }

  // The placement after this move turns the piece that lies at `placement`.
  turn<TCoord>(placement: Placement<TCoord>, topology: { fullTurn(): Turns }): Placement<TCoord> {
    return placement.turned(this.steps, topology);
  }

  // True when the piece is on the figure and the turned piece fits on free figure cells
  // or on its own cells.
  isValidOn<TCoord>(state: FitState<TCoord>, photo: FitSnapshot<TCoord>): boolean {
    const board = photo.boardCopy();
    const placement = state.placementOf(this.pieceId);
    return placement !== undefined && fits(state, board, this.pieceId, this.turn(placement, board));
  }

  // Removes the piece and places it again, turned. A piece off the figure throws a RangeError
  // before any change. The error carries the piece as its `cause` (issue #237).
  applyTo<TCoord>(state: FitState<TCoord>): void {
    const board = state.snapshot().boardCopy();
    const placement = state.placementOf(this.pieceId);
    if (placement === undefined) {
      throw new RangeError('The piece is not on the figure.', { cause: this.pieceId });
    }
    state.remove(this.pieceId);
    state.place(this.pieceId, this.turn(placement, board));
  }

  // Two rotate moves are equal when they have the same piece and the same step count.
  equals(other: FitMove<unknown>): boolean {
    return (
      isOfClassOf(this, other) &&
      this.pieceId.equals(other.pieceId) &&
      this.steps.equals(other.steps)
    );
  }
}

export type FitMove<TCoord> = PlaceFitPiece<TCoord> | RemoveFitPiece | RotateFitPiece;

// True when `other` is an object of the class of `move`. A move compares its parts only
// with a move of its own class, so two moves of two kinds are never equal.
// The check names no move class, so a new kind of move uses it as it is.
function isOfClassOf<TMove>(move: TMove, other: unknown): other is TMove {
  return (
    typeof other === 'object' &&
    other !== null &&
    Object.getPrototypeOf(other) === Object.getPrototypeOf(move)
  );
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
  return placement.cells(piece, board).every((c) => {
    if (!board.contains(c)) return false;
    const cell = board.occupantAt(c);
    return cell === undefined || cell.equals(id);
  });
}
