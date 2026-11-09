import type { CoordKey } from '../../engine/coord-key';
import type { GridTopology } from '../../engine/grid-topology';
import type { Piece } from '../../engine/piece';
import { Turns } from '../../engine/turns';
import type { PieceId } from './piece-id';

// Where a piece lies on the figure: its rotation and its offset. It is a value object.
// The rotation is stored as a count from 0 to `rotationSteps - 1` of the topology,
// so a long series of rotations never leaves the safe integer range.
export class Placement<TCoord> {
  private constructor(
    readonly rotation: Turns,
    readonly at: TCoord,
  ) {}

  static of<TCoord>(
    rotation: Turns,
    at: TCoord,
    topology: GridTopology<TCoord, string, string>,
  ): Placement<TCoord> {
    return new Placement(normalized(rotation.value, topology), at);
  }

  // The same offset, turned by `steps` more.
  turned(steps: Turns, topology: GridTopology<TCoord, string, string>): Placement<TCoord> {
    const extra = normalized(steps.value, topology).value;
    return new Placement(normalized(this.rotation.value + extra, topology), this.at);
  }

  // The figure cells that the piece covers: the topology turns it and then moves it.
  cells(piece: Piece<PieceId, TCoord>, topology: GridTopology<TCoord, string, string>): TCoord[] {
    return piece.rotated(this.rotation, topology).translated(this.at, topology).shape.cells();
  }

  // Two placements are equal when they have the same rotation and the same offset.
  // The topology compares the offsets, because `TCoord` has no `equals`.
  equals(other: Placement<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return this.rotation.equals(other.rotation) && topology.key(this.at) === topology.key(other.at);
  }
}

function normalized(steps: number, topology: GridTopology<unknown, string, string>): Turns {
  const n = topology.rotationSteps;
  return Turns.of(((steps % n) + n) % n);
}
