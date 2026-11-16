import type { BoardShape } from '../../engine/board-shape';
import type { CoordKey } from '../../engine/coord-key';
import type { TopologyId } from '../../engine/geometry-factory';
import type { Piece } from '../../engine/piece';
import { FixedListPieceSource } from '../../engine/piece-source';
import { CellNode, ShapeGroup } from '../../engine/shape-node';
import type { PieceId } from './piece-id';

// The part of a geometry that a level asks: whether the geometry is of a family.
// A geometry of any coordinate type answers it (classes.md decision 17).
type Family = { isOfFamily(id: TopologyId): boolean };

// One Hexa Fit level: the id of its geometry family, the figure and its pieces.
// It is a value object (classes.md decision 46, issue #208): it never changes,
// its fields are private, and two levels are equal when their parts are equal.
// The level guards its own invariant. `of()` makes every check that needs only the level,
// so a level with two pieces of one id cannot exist, and neither can a level
// with a piece list that holds `undefined`.
// `of()` copies the piece list and freezes the copy, and the object is frozen.
// So a change to the array of the caller does not change the level.
// The level cannot check its figure, because only a topology finds a repeated coordinate.
// `Board` makes that check when the game starts.
// `FitFactory` checks the geometry, because only the factory holds one.
// The geometry keeps its family private, so the level asks it with `isOfFamily()` (issue #234).
// `FitLevelBuilder` builds the level through `of()` in Sprint 3 (#166).
export class FitLevel<TCoord> {
  private constructor(
    private readonly topology: TopologyId,
    private readonly figure: BoardShape<TCoord>,
    private readonly pieces: readonly Piece<PieceId, TCoord>[],
  ) {
    Object.freeze(this);
  }

  // Two pieces with the same id throw a RangeError, because a move names its piece by id.
  // The error carries the id as its `cause`, and the edge delivers its text (issue #237).
  // `FixedListPieceSource` holds the check of `undefined`, so the level reads its copy.
  static of<TCoord>(
    topology: TopologyId,
    figure: BoardShape<TCoord>,
    pieces: readonly Piece<PieceId, TCoord>[],
  ): FitLevel<TCoord> {
    const copy = [...new FixedListPieceSource(pieces)];
    copy.forEach((piece, index) => {
      const id = piece.occupant();
      if (copy.slice(0, index).some((earlier) => earlier.occupant().equals(id))) {
        throw new RangeError('The level has two pieces with one id.', { cause: id });
      }
    });
    return new FitLevel(topology, figure, Object.freeze(copy));
  }

  // True when the level runs on `geometry`: the geometry is of the family that the level names.
  // The geometry asks, so a text that a cast puts in the level gives false.
  runsOn(geometry: Family): boolean {
    return geometry.isOfFamily(this.topology);
  }

  // The error of a level that starts on a geometry of another family.
  // The error carries the topology of the level and the geometry as its `cause` (issue #237).
  // The geometry keeps its family private (issue #234), so the edge delivers only
  // the text of the topology.
  wrongFamily(geometry: Family): RangeError {
    return new RangeError('A Fit level cannot start on the geometry of another topology.', {
      cause: { topology: this.topology, geometry },
    });
  }

  // The figure as a tree of cells, as `BoardBuilder` takes it. Each call gives a new tree.
  figureTree(): ShapeGroup<TCoord> {
    return new ShapeGroup(this.figure.coordinates().map((c) => new CellNode(c)));
  }

  // The pieces of the tray at the start, in the order of the level. The list is frozen.
  trayPieces(): readonly Piece<PieceId, TCoord>[] {
    return this.pieces;
  }

  // Two levels are equal when they name the same family, cover the same figure
  // and hold equal pieces in the same order. The tray keeps the order of the level.
  // The topology compares the coordinates, because `TCoord` has no bound (classes.md decision 16).
  equals(other: FitLevel<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return (
      this.topology.equals(other.topology) &&
      this.figure.equals(other.figure, topology) &&
      this.pieces.length === other.pieces.length &&
      this.pieces.every((piece, i) => {
        const theirs = other.pieces[i];
        return theirs !== undefined && piece.equals(theirs, topology, (a, b) => a.equals(b));
      })
    );
  }
}
