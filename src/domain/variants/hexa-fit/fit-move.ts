import type { CoordKey } from '../../engine/coord-key';
import type { GridTopology } from '../../engine/grid-topology';
import type { Turns } from '../../engine/turns';
import type { PieceId } from './piece-id';
import { Placement } from './placement';

// The moves of Hexa Fit: place, remove or rotate a piece (REQUIREMENTS.md §1).
// `FitMove` is a closed union of three classes. The class tells the three moves apart.
// Each move is a value object (classes.md decision 43): it never changes, its fields are
// private, and two moves are equal when they are of the same class and hold the same parts.
// A move does not know the figure. The rules ask the move for its piece and for the placement
// that it gives, and they check both on the board.
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
  piece(): PieceId {
    return this.pieceId;
  }

  // Where this move puts the piece: its rotation and its offset on the topology.
  placement(topology: GridTopology<TCoord, string, string>): Placement<TCoord> {
    return Placement.of(this.rotation, this.at, topology);
  }

  // Two place moves are equal when they have the same piece, the same rotation count
  // and the same offset. The move compares the counts as the player gave them.
  // The topology compares the offsets, because `TCoord` has no bound (classes.md decision 16).
  equals(other: FitMove<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return (
      other instanceof PlaceFitPiece &&
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
  piece(): PieceId {
    return this.pieceId;
  }

  // Two remove moves are equal when they name the same piece.
  equals(other: FitMove<unknown>): boolean {
    return other instanceof RemoveFitPiece && this.pieceId.equals(other.pieceId);
  }
}

// Turns a placed piece by `steps` around its own origin. The offset of the piece stays.
export class RotateFitPiece {
  constructor(
    private readonly pieceId: PieceId,
    private readonly steps: Turns,
  ) {}

  // The piece that this move turns.
  piece(): PieceId {
    return this.pieceId;
  }

  // The placement after this move turns the piece that lies at `placement`.
  turn<TCoord>(
    placement: Placement<TCoord>,
    topology: GridTopology<TCoord, string, string>,
  ): Placement<TCoord> {
    return placement.turned(this.steps, topology);
  }

  // Two rotate moves are equal when they have the same piece and the same step count.
  equals(other: FitMove<unknown>): boolean {
    return (
      other instanceof RotateFitPiece &&
      this.pieceId.equals(other.pieceId) &&
      this.steps.equals(other.steps)
    );
  }
}

export type FitMove<TCoord> = PlaceFitPiece<TCoord> | RemoveFitPiece | RotateFitPiece;
