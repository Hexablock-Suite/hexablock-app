import type { Board } from '../../engine/board';
import type { BoardId } from '../../engine/board-id';
import { BoardBuilder } from '../../engine/board-builder';
import { BoardShape } from '../../engine/board-shape';
import type { Color } from '../../engine/color';
import type { CoordKey } from '../../engine/coord-key';
import { GameId } from '../../engine/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { GeometryFactory } from '../../engine/geometry-factory';
import type { MatchId } from '../../engine/match-id';
import { Piece } from '../../engine/piece';
import { FixedListPieceSource, SeededPieceSource } from '../../engine/piece-source';
import type { RandomSource } from '../../engine/random-source';
import type { RegionSize } from '../../engine/region-size';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { Seed } from '../../engine/seed';
import type { ShapeNode } from '../../engine/shape-node';
import type { IVariantFactory } from '../../engine/variant-factory';
import { ComboMultiplierDecorator } from './combo-multiplier-decorator';
import { LinesRules } from './lines-rules';
import { LinesScoring } from './lines-scoring';
import { LinesState } from './lines-state';
import type { PlacePiece } from './place-piece';

// The settings of one Hexa Lines game: the board region, the seed of the pieces,
// and the piece shapes and colors that the source draws from.
// It is a value object (classes.md decision 48, issue #210), in the form of `FitLevel`:
// it never changes, its fields are private, and two settings are equal when their parts are equal.
// An object literal is no longer the settings of a game.
// The settings guard their own invariant: each list holds one item or more, and no `undefined`.
// `of()` copies each list and freezes the copy, and the object is frozen.
// So a change to an array of the caller does not change the settings.
// The seed is a `Seed`, which checks its own range.
export class LinesSettings<TCoord> {
  private constructor(
    private readonly size: RegionSize,
    private readonly seed: Seed,
    private readonly shapes: readonly ShapeNode<TCoord>[],
    private readonly colors: readonly Color[],
  ) {
    Object.freeze(this);
  }

  // A list with no item throws a RangeError, because a draw needs a shape and a color to pick.
  // `FixedListPieceSource` holds the check of `undefined`, so the settings read its copy.
  static of<TCoord>(
    size: RegionSize,
    seed: Seed,
    shapes: readonly [ShapeNode<TCoord>, ...ShapeNode<TCoord>[]],
    colors: readonly [Color, ...Color[]],
  ): LinesSettings<TCoord> {
    const shapesCopy = [...new FixedListPieceSource<ShapeNode<TCoord>>(shapes)];
    const colorsCopy = [...new FixedListPieceSource<Color>(colors)];
    if (shapesCopy.length === 0) {
      throw new RangeError('The Lines settings need one shape or more.');
    }
    if (colorsCopy.length === 0) {
      throw new RangeError('The Lines settings need one color or more.');
    }
    return new LinesSettings(size, seed, Object.freeze(shapesCopy), Object.freeze(colorsCopy));
  }

  // The size of the board region of the game.
  boardSize(): RegionSize {
    return this.size;
  }

  // The seed of the piece source of the game.
  pieceSeed(): Seed {
    return this.seed;
  }

  // One piece of the game. The draw reads two numbers of `random`:
  // the first picks the shape, and the second picks the color.
  drawPiece(random: RandomSource): Piece<Color, TCoord> {
    return new Piece(pick(this.shapes, random), pick(this.colors, random));
  }

  // Two settings are equal when they hold the same size, the same seed, and equal shapes
  // and equal colors in the same order. A draw picks a shape and a color by its place in the list.
  // Two shapes are equal when they cover the same coordinates.
  // The topology compares the coordinates, because `TCoord` has no bound (classes.md decision 16).
  equals(other: LinesSettings<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return (
      this.size.equals(other.size) &&
      this.seed.equals(other.seed) &&
      this.shapes.length === other.shapes.length &&
      this.shapes.every((shape, i) => {
        const theirs = other.shapes[i];
        return theirs !== undefined && sameCells(shape, theirs, topology);
      }) &&
      this.colors.length === other.colors.length &&
      this.colors.every((color, i) => other.colors[i]?.equals(color) === true)
    );
  }
}

// Abstract Factory (classes.md decision 31): the whole family of Hexa Lines.
// The geometry comes by composition (APP-FR-16, D11), so the factory runs on any figure.
// The seed comes by injection (R-domain-determinism), so the same seed gives the same game.
export class LinesFactory<TCoord> implements IVariantFactory<
  Color,
  TCoord,
  PlacePiece<TCoord>,
  LinesState<TCoord>
> {
  readonly gameId = GameId.of('hexa-lines');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly settings: LinesSettings<TCoord>,
  ) {}

  createRules(): IGameRules<PlacePiece<TCoord>, LinesState<TCoord>> {
    return new LinesRules<TCoord>();
  }

  createScoring(): IScoringPolicy<LinesState<TCoord>> {
    return new ComboMultiplierDecorator(new LinesScoring<TCoord>());
  }

  // A new source for each game, built from the data of the settings.
  // The settings give the seed, and they draw each piece.
  createPieceSource(): SeededPieceSource<Piece<Color, TCoord>> {
    const { settings } = this;
    return new SeededPieceSource(settings.pieceSeed(), (random: RandomSource) =>
      settings.drawPiece(random),
    );
  }

  createBoard(boardId: BoardId): Board<Color, TCoord> {
    return new BoardBuilder(this.geometry)
      .withRegion(this.settings.boardSize())
      .build<Color>(boardId);
  }

  createInitialState(matchId: MatchId, stateId: GameStateId, boardId: BoardId): LinesState<TCoord> {
    return LinesState.start(stateId, matchId, this.createBoard(boardId), this.createPieceSource());
  }

  // Hexa Lines has no undo (APP-FR-08, classes.md decision 3).
  createHistory(): undefined {
    return undefined;
  }
}

// The item that one number of `random` picks. The settings hold one item or more in each list.
function pick<T>(items: readonly T[], random: RandomSource): T {
  return items[Math.floor(random.next() * items.length)] ?? (items[0] as T);
}

// True when two shapes cover the same coordinates.
function sameCells<TCoord>(
  left: ShapeNode<TCoord>,
  right: ShapeNode<TCoord>,
  topology: { key(c: TCoord): CoordKey },
): boolean {
  return BoardShape.of(left.cells()).equals(BoardShape.of(right.cells()), topology);
}
