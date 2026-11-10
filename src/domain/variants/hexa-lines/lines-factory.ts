import type { Board } from '../../engine/board';
import type { BoardId } from '../../engine/board-id';
import { BoardBuilder } from '../../engine/board-builder';
import type { Color } from '../../engine/color';
import { GameId } from '../../engine/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { GeometryFactory } from '../../engine/geometry-factory';
import type { MatchId } from '../../engine/match-id';
import { Piece } from '../../engine/piece';
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

// The settings of one Hexa Lines game: the board region, the seed of the pieces,
// and the piece shapes and colors that the source draws from. Each list holds one item or more.
export interface LinesSettings<TCoord> {
  readonly size: RegionSize;
  readonly seed: number;
  readonly shapes: readonly [ShapeNode<TCoord>, ...ShapeNode<TCoord>[]];
  readonly colors: readonly [Color, ...Color[]];
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

  // Each draw reads two numbers: the first picks the shape, the second picks the color.
  createPieceSource(): SeededPieceSource<Piece<Color, TCoord>> {
    const { seed, shapes, colors } = this.settings;
    return new SeededPieceSource(
      seed,
      (random: RandomSource) => new Piece(pick(shapes, random), pick(colors, random)),
    );
  }

  createBoard(boardId: BoardId): Board<Color, TCoord, string> {
    return new BoardBuilder(this.geometry).withRegion(this.settings.size).build<Color>(boardId);
  }

  createInitialState(matchId: MatchId, stateId: GameStateId, boardId: BoardId): LinesState<TCoord> {
    return LinesState.start(stateId, matchId, this.createBoard(boardId), this.createPieceSource());
  }

  // Hexa Lines has no undo (APP-FR-08, classes.md decision 3).
  createHistory(): undefined {
    return undefined;
  }
}

function pick<T>(items: readonly [T, ...T[]], random: RandomSource): T {
  return items[Math.floor(random.next() * items.length)] ?? items[0];
}
