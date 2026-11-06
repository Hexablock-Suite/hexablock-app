import type { Turns } from '../../engine/turns';
import type { PieceId } from './piece-id';

// The moves of Hexa Fit: place, remove or rotate a piece (REQUIREMENTS.md §1).
// `FitMove` is a closed union. The `kind` field tells the three moves apart.
// A rotation counts steps of the topology, never degrees (A5, D4).

// Puts a tray piece on the figure. The piece turns by `rotation` around its own origin,
// and then moves by the offset `at`.
export class PlaceFitPiece<TCoord> {
  readonly kind = 'place';
  constructor(
    readonly pieceId: PieceId,
    readonly rotation: Turns,
    readonly at: TCoord,
  ) {}
}

// Takes a placed piece back to the tray.
export class RemoveFitPiece {
  readonly kind = 'remove';
  constructor(readonly pieceId: PieceId) {}
}

// Turns a placed piece by `steps` around its own origin. The offset of the piece stays.
export class RotateFitPiece {
  readonly kind = 'rotate';
  constructor(
    readonly pieceId: PieceId,
    readonly steps: Turns,
  ) {}
}

export type FitMove<TCoord> = PlaceFitPiece<TCoord> | RemoveFitPiece | RotateFitPiece;
