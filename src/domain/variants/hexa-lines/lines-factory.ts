import type { Board } from '../../engine/board';
import type { BoardId } from '../../engine/board-id';
import { BoardBuilder } from '../../engine/board-builder';
import { BoardShape } from '../../engine/board-shape';
import type { Color } from '../../engine/color';
import type { CoordKey } from '../../engine/coord-key';
import { GameId } from '../../shared/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { GeometryFactory } from '../../engine/geometry-factory';
import { HighScoreProgress } from '../../progress/high-score-progress';
import type { MatchId } from '../../engine/match-id';
import { Piece } from '../../engine/piece';
import { frozenListOf } from '../../engine/frozen-list';
import { SeededPieceSource } from '../../engine/piece-source';
import type { RandomSource } from '../../engine/random-source';
import type { RegionSize } from '../../engine/region-size';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { ShapeNode } from '../../engine/shape-node';
import type { IVariantFactory } from '../../engine/variant-factory';
import { ComboMultiplierDecorator } from './combo-multiplier-decorator';
import { LinesRules } from './lines-rules';
import { LinesScoring } from './lines-scoring';
import { LinesState } from './lines-state';
import type { PlacePiece } from './place-piece';

// The settings of one Hexa Lines game: the board region, and the piece shapes and colors
// that the source draws from. The settings hold no seed: each match draws its own (issue #417).
// It is a value object (classes.md decision 48, issue #210), in the form of `FitLevel`:
// it never changes, its fields are private, and two settings are equal when their parts are equal.
// An object literal is no longer the settings of a game.
// The settings guard their own invariant: each list holds one item or more, and no `undefined`.
// `of()` copies each list with `frozenListOf()`, and the object is frozen.
// So a change to an array of the caller does not change the settings.
export class LinesSettings<TCoord> {
  private constructor(
    private readonly size: RegionSize,
    private readonly shapes: readonly ShapeNode<TCoord>[],
    private readonly colors: readonly Color[],
  ) {
    Object.freeze(this);
  }

  // A list with no item throws a RangeError, because a draw needs a shape and a color to pick.
  // `frozenListOf()` copies each list and refuses `undefined`.
  static of<TCoord>(
    size: RegionSize,
    shapes: readonly [ShapeNode<TCoord>, ...ShapeNode<TCoord>[]],
    colors: readonly [Color, ...Color[]],
  ): LinesSettings<TCoord> {
    const shapesCopy = frozenListOf(shapes);
    const colorsCopy = frozenListOf(colors);
    if (shapesCopy.length === 0) {
      throw new RangeError('The Lines settings need one shape or more.');
    }
    if (colorsCopy.length === 0) {
      throw new RangeError('The Lines settings need one color or more.');
    }
    return new LinesSettings(size, shapesCopy, colorsCopy);
  }

  // The size of the board region of the game.
  boardSize(): RegionSize {
    return this.size;
  }

  // One piece of the game. The draw reads two numbers of `random`:
  // the first picks the shape, and the second picks the color.
  drawPiece(random: RandomSource): Piece<Color, TCoord> {
    return new Piece(pick(this.shapes, random), pick(this.colors, random));
  }

  // Two settings are equal when they hold the same size, and equal shapes
  // and equal colors in the same order. A draw picks a shape and a color by its place in the list.
  // Two shapes are equal when they cover the same coordinates.
  // The topology compares the coordinates, because `TCoord` has no bound (classes.md decision 16).
  equals(other: LinesSettings<TCoord>, topology: { key(c: TCoord): CoordKey }): boolean {
    return (
      this.size.equals(other.size) &&
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
// The random source comes by injection (R-domain-determinism, classes.md decision 25).
// Each match draws a new seed from it, so a replay gets other pieces (issue #417).
// A source with the same draws gives the same game (APP-NFR-07).
export class LinesFactory<TCoord> implements IVariantFactory<
  Color,
  TCoord,
  PlacePiece<TCoord>,
  LinesState<TCoord>
> {
  private readonly gameId = GameId.of('hexa-lines');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly settings: LinesSettings<TCoord>,
    private readonly random: RandomSource,
  ) {}

  // True when `gameId` names Hexa Lines. The id stays private (issue #234).
  isFor(gameId: GameId): boolean {
    return this.gameId.equals(gameId);
  }

  createRules(): IGameRules<PlacePiece<TCoord>, LinesState<TCoord>> {
    return new LinesRules<TCoord>();
  }

  // Hexa Lines has no timer (classes.md decision 19).
  createTimer(_matchId: MatchId): undefined {
    return undefined;
  }

  createScoring(): IScoringPolicy<LinesState<TCoord>> {
    return new ComboMultiplierDecorator(new LinesScoring<TCoord>());
  }

  // A new source for each match, from a new seed of the random source of the factory.
  // The settings draw each piece.
  createPieceSource(): SeededPieceSource<Piece<Color, TCoord>> {
    const { settings } = this;
    return new SeededPieceSource(this.random.next().pickSeed(), (random: RandomSource) =>
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

  // Hexa Lines keeps a high score (APP-FR-04).
  createProgressModel(): HighScoreProgress {
    return new HighScoreProgress();
  }
}

// The item that one draw of `random` picks. The settings hold one item or more in each list.
function pick<T>(items: readonly T[], random: RandomSource): T {
  return random.next().pick(items);
}

// True when two shapes cover the same coordinates.
function sameCells<TCoord>(
  left: ShapeNode<TCoord>,
  right: ShapeNode<TCoord>,
  topology: { key(c: TCoord): CoordKey },
): boolean {
  return BoardShape.of(left.cells()).equals(BoardShape.of(right.cells()), topology);
}
