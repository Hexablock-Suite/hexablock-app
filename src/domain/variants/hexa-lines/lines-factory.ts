import { Board } from '../../engine/board';
import type { Color } from '../../engine/color';
import { GameId } from '../../engine/game-id';
import type { GridTopology } from '../../engine/grid-topology';
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
// The topology is the geometry seam. `GeometryFactory<TCoord>` replaces it in Sprint 3
// (APP-FR-16, D11), and then it gives the topology and the piece shapes.
// The seed comes by injection (R-domain-determinism), so the same seed gives the same game.
export class LinesFactory<TCoord> implements IVariantFactory<
  Color,
  TCoord,
  PlacePiece<TCoord>,
  LinesState<TCoord>
> {
  readonly gameId = GameId.of('hexa-lines');

  constructor(
    private readonly topology: GridTopology<TCoord, string, string>,
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

  createBoard(): Board<Color, TCoord, string> {
    return new Board<Color, TCoord, string>(
      this.topology.region(this.settings.size),
      this.topology,
    );
  }

  createInitialState(): LinesState<TCoord> {
    return LinesState.start(this.createBoard(), this.createPieceSource());
  }
}

function pick<T>(items: readonly [T, ...T[]], random: RandomSource): T {
  return items[Math.floor(random.next() * items.length)] ?? items[0];
}
