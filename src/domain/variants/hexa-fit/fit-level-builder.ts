import { BoardShape } from '../../engine/board-shape';
import type { CoordKey } from '../../engine/coord-key';
import { ElapsedTime } from '../../engine/elapsed-time';
import type { GeometryFactory, TopologyId } from '../../engine/geometry-factory';
import type { ILevelBuilder } from '../../engine/level-builder';
import { Moves } from '../../engine/moves';
import { Piece } from '../../engine/piece';
import { CellNode, ShapeGroup } from '../../engine/shape-node';
import { Turns } from '../../engine/turns';
import { FitLevel } from './fit-level';
import { FitStarThreshold } from './fit-stars';
import { PieceId } from './piece-id';

const NO_SECTION = 'The section of a Fit level needs a figure, pieces, a witness and stars.';
const NO_ITEM = 'A Fit level needs a list of one item or more in each field.';
const BAD_CELL = 'A cell of a Fit level is a list of numbers.';
const BAD_PIECE = 'A piece of a Fit level needs a text id and cells.';
const BAD_PLACEMENT = 'A placement of a Fit witness needs a piece id, a rotation and an offset.';
const BAD_STAR = 'A star of a Fit level needs a move count and a time.';
const UNEQUAL_AREA = 'The pieces of a Fit level do not have the area of its figure.';
const INEXACT_WITNESS = 'The witness of a Fit level does not cover its figure exactly.';

// The fields of one JSON object of a level file, by name.
type Fields = Readonly<Record<string, unknown>>;

// Concrete Builder (statement §3.3, classes.md decision 15, D9): it builds a `FitLevel`
// step by step from the data of a level file. `LevelDefinition` directs it.
// The builder holds the `GeometryFactory` that it receives (classes.md decision 17).
// `withTopology()` refuses a topology of another family, so the builder reads each coordinate
// of the file through the geometry that the topology of the level names (issue #166).
// `withSection()` adds the figure, the pieces, the witness and the stars of the section.
// It checks each field that it reads at runtime, because a level file has no compile-time types.
// A value that it refuses goes into the error as its `cause` (issue #237).
// `build()` checks A5: the areas of the pieces add up to the area of the figure, and the witness
// places each piece once and covers each cell of the figure once (REQUIREMENTS.md A5).
// It creates the level through `FitLevel.of()`, so a level with two pieces of one id
// cannot exist (classes.md decision 46). The level keeps no witness: only `build()` reads it.
// The builder never reads a file (classes.md decision 24).
export class FitLevelBuilder<TCoord> implements ILevelBuilder<FitLevel<TCoord>> {
  private topology: TopologyId | undefined;
  private figure: BoardShape<TCoord> | undefined;
  private pieces: readonly Piece<PieceId, TCoord>[] | undefined;
  // Each placement of the witness: the piece, its rotation and its offset (A5).
  private witness: readonly (readonly [PieceId, Turns, TCoord])[] | undefined;
  private stars: readonly FitStarThreshold[] | undefined;

  constructor(private readonly geometry: GeometryFactory<TCoord>) {}

  // The error carries the topology and the geometry as its `cause`.
  withTopology(topology: TopologyId): FitLevelBuilder<TCoord> {
    if (!this.geometry.isOfFamily(topology)) {
      throw new RangeError('A Fit level builder cannot read the coordinates of another topology.', {
        cause: { topology, geometry: this.geometry },
      });
    }
    this.topology = topology;
    return this;
  }

  withSection(section: unknown): FitLevelBuilder<TCoord> {
    const { figure, pieces, witness, stars } = fieldsOf(
      section,
      ['figure', 'pieces', 'witness', 'stars'],
      NO_SECTION,
    );
    return this.withFigure(figure).withPieces(pieces).withWitness(witness).withStars(stars);
  }

  // A builder with no topology or no section throws a RangeError.
  build(): FitLevel<TCoord> {
    const { topology, figure, pieces, witness, stars } = this;
    if (
      topology === undefined ||
      figure === undefined ||
      pieces === undefined ||
      witness === undefined ||
      stars === undefined
    ) {
      throw new RangeError('A Fit level builder needs a topology and a section.');
    }
    const level = FitLevel.of(topology, figure, pieces, stars);
    this.checkWitness(figure, pieces, witness);
    return level;
  }

  // Each cell is a coordinate of the figure.
  private withFigure(figure: unknown): FitLevelBuilder<TCoord> {
    this.figure = BoardShape.of(listOf(figure).map((cell) => this.coordOf(cell)));
    return this;
  }

  // Each piece is a text id and its cells, relative to the origin of the piece.
  private withPieces(pieces: unknown): FitLevelBuilder<TCoord> {
    this.pieces = listOf(pieces).map((piece) => {
      const { id, cells } = fieldsOf(piece, ['id', 'cells'], BAD_PIECE);
      if (typeof id !== 'string') throw new RangeError(BAD_PIECE, { cause: piece });
      const shape = new ShapeGroup(listOf(cells).map((cell) => new CellNode(this.coordOf(cell))));
      return new Piece(shape, PieceId.of(id));
    });
    return this;
  }

  // Each placement turns its piece by `rotation` steps of the topology, then moves it by `at`.
  private withWitness(witness: unknown): FitLevelBuilder<TCoord> {
    this.witness = listOf(witness).map((entry) => {
      const { piece, rotation, at } = fieldsOf(entry, ['piece', 'rotation', 'at'], BAD_PLACEMENT);
      if (typeof piece !== 'string' || typeof rotation !== 'number') {
        throw new RangeError(BAD_PLACEMENT, { cause: entry });
      }
      return [PieceId.of(piece), Turns.of(rotation), this.coordOf(at)] as const;
    });
    return this;
  }

  // Each threshold holds a move count and a time in milliseconds, from the first star up.
  private withStars(stars: unknown): FitLevelBuilder<TCoord> {
    this.stars = listOf(stars).map((threshold) => {
      const { maxMoves, maxElapsedMs } = fieldsOf(
        threshold,
        ['maxMoves', 'maxElapsedMs'],
        BAD_STAR,
      );
      if (typeof maxMoves !== 'number' || typeof maxElapsedMs !== 'number') {
        throw new RangeError(BAD_STAR, { cause: threshold });
      }
      return FitStarThreshold.of({
        maxMoves: Moves.of(maxMoves),
        maxElapsedMs: ElapsedTime.ofMs(maxElapsedMs),
      });
    });
    return this;
  }

  // The geometry turns the values of one cell into a coordinate and checks them.
  private coordOf(cell: unknown): TCoord {
    if (!Array.isArray(cell) || !cell.every((value) => typeof value === 'number')) {
      throw new RangeError(BAD_CELL, { cause: cell });
    }
    return this.geometry.createCoord(cell);
  }

  // A5. The topology keys each cell, because `TCoord` has no bound (classes.md decision 16).
  // A cell that the figure lists twice counts twice, so no witness covers that figure exactly.
  private checkWitness(
    figure: BoardShape<TCoord>,
    pieces: readonly Piece<PieceId, TCoord>[],
    witness: readonly (readonly [PieceId, Turns, TCoord])[],
  ): void {
    const topology = this.geometry.createTopology();
    const cells = figure.keys(topology);
    const area = pieces.reduce((sum, piece) => sum + piece.coveredCoordinates().length, 0);
    if (area !== cells.length) throw new RangeError(UNEQUAL_AREA);
    const placesOf = (piece: Piece<PieceId, TCoord>) =>
      witness.filter(([id]) => id.equals(piece.occupant())).length;
    const eachPieceOnce =
      witness.length === pieces.length && pieces.every((p) => placesOf(p) === 1);
    const covered = witness.flatMap(([id, rotation, at]) => {
      const piece = pieces.find((candidate) => candidate.occupant().equals(id));
      if (piece === undefined) return [];
      const placed = piece.rotated(rotation, topology).translated(at, topology);
      return placed.coveredCoordinates().map((c) => topology.key(c));
    });
    if (!eachPieceOnce || new Set(covered).size !== covered.length || !sameKeys(covered, cells)) {
      throw new RangeError(INEXACT_WITNESS);
    }
  }
}

// The fields of a JSON object that holds every field of `names`.
// Any other value throws a RangeError with `message`, and the value is its `cause`.
function fieldsOf(value: unknown, names: readonly string[], message: string): Fields {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !names.every((name) => name in value)
  ) {
    throw new RangeError(message, { cause: value });
  }
  return value as Fields;
}

// A JSON list of one item or more. Any other value throws a RangeError with the value as `cause`.
function listOf(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new RangeError(NO_ITEM, { cause: value });
  return value;
}

// True when two lists hold the same keys, each key as many times, in any order.
function sameKeys(left: readonly CoordKey[], right: readonly CoordKey[]): boolean {
  const mine = [...left].sort();
  const theirs = [...right].sort();
  return mine.length === theirs.length && mine.every((key, i) => key === theirs[i]);
}
