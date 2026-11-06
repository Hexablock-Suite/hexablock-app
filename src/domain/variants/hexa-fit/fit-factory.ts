import { Board } from '../../engine/board';
import type { BoardShape } from '../../engine/board-shape';
import { GameId } from '../../engine/game-id';
import type { GridTopology } from '../../engine/grid-topology';
import type { Piece } from '../../engine/piece';
import { FixedListPieceSource } from '../../engine/piece-source';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { IVariantFactory } from '../../engine/variant-factory';
import type { FitMove } from './fit-move';
import { FitRules } from './fit-rules';
import { FitScoring } from './fit-scoring';
import { FitState } from './fit-state';
import type { PieceId } from './piece-id';

// One Hexa Fit level: the figure and its pieces. `FitLevelBuilder` builds it in Sprint 3.
export interface FitLevel<TCoord> {
  readonly figure: BoardShape<TCoord>;
  readonly pieces: readonly Piece<PieceId, TCoord>[];
}

// Abstract Factory (classes.md decision 31): the whole family of one Hexa Fit level.
// The topology is the geometry seam. `GeometryFactory<TCoord>` replaces it in Sprint 3
// (APP-FR-16, D11). `TimedRulesDecorator` is Sprint 3 work too (D14), so the rules
// are the plain `FitRules` today.
export class FitFactory<TCoord> implements IVariantFactory<
  PieceId,
  TCoord,
  FitMove<TCoord>,
  FitState<TCoord>
> {
  readonly gameId = GameId.of('hexa-fit');

  constructor(
    private readonly topology: GridTopology<TCoord, string, string>,
    private readonly level: FitLevel<TCoord>,
  ) {}

  createRules(): IGameRules<FitMove<TCoord>, FitState<TCoord>> {
    return new FitRules<TCoord>();
  }

  createScoring(): IScoringPolicy<FitState<TCoord>> {
    return new FitScoring<TCoord>();
  }

  // A finite source of the level pieces, so the Fit tray is finite (classes.md decision 32).
  createPieceSource(): FixedListPieceSource<Piece<PieceId, TCoord>> {
    return new FixedListPieceSource(this.level.pieces);
  }

  // The board is the figure: its shape holds only the figure cells.
  createBoard(): Board<PieceId, TCoord, string> {
    return new Board<PieceId, TCoord, string>(this.level.figure, this.topology);
  }

  createInitialState(): FitState<TCoord> {
    return FitState.start(this.createBoard(), this.createPieceSource());
  }
}
