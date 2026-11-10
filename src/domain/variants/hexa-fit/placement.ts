import type { CoordKey } from '../../engine/coord-key';
import type { ReadonlyBoard } from '../../engine/board';
import type { Piece } from '../../engine/piece';
import type { Turns } from '../../engine/turns';
import type { PieceId } from './piece-id';

// Where a piece lies on the figure: its rotation and its offset. It is a value object.
// The rotation is stored as a count that is shorter than the full turn of the topology,
// so a long series of rotations never leaves the safe integer range.
// `of()` and `turned()` need only the full turn. A topology gives it, and so does a board.
export class Placement<TCoord> {
  private constructor(
    private readonly rotation: Turns,
    private readonly at: TCoord,
  ) {}

  static of<TCoord>(
    rotation: Turns,
    at: TCoord,
    topology: { fullTurn(): Turns },
  ): Placement<TCoord> {
    return new Placement(rotation.normalized(topology), at);
  }

  // The same offset, turned by `steps` more.
  turned(steps: Turns, topology: { fullTurn(): Turns }): Placement<TCoord> {
    const sum = this.rotation.plus(steps.normalized(topology));
    return new Placement(sum.normalized(topology), this.at);
  }

  // The figure cells that the piece covers: the board turns it and then moves it.
  // The board does not cut the piece, so a cell can lie outside the figure.
  cells(piece: Piece<PieceId, TCoord>, board: ReadonlyBoard<PieceId, TCoord>): TCoord[] {
    return board.moved(board.turned(piece, this.rotation), this.at).cells();
  }

  // Two placements are equal when they have the same rotation and the same offset.
  // The topology compares the offsets, because `TCoord` has no bound (classes.md decision 16).
  equals(other: Placement<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return this.rotation.equals(other.rotation) && topology.key(this.at) === topology.key(other.at);
  }
}
