import type { Board } from '../../engine/board';
import { BoardBuilder } from '../../engine/board-builder';
import type { BoardShape } from '../../engine/board-shape';
import { GameId } from '../../engine/game-id';
import type { GeometryFactory, TopologyId } from '../../engine/geometry-factory';
import { MoveHistory } from '../../engine/move-history';
import type { Piece } from '../../engine/piece';
import { FixedListPieceSource } from '../../engine/piece-source';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import { CellNode, ShapeGroup } from '../../engine/shape-node';
import type { IVariantFactory } from '../../engine/variant-factory';
import type { FitMove } from './fit-move';
import { FitRules } from './fit-rules';
import { FitScoring } from './fit-scoring';
import { FitState } from './fit-state';
import type { PieceId } from './piece-id';

// One Hexa Fit level: the id of its geometry family, the figure and its pieces.
// `FitLevelBuilder` builds it in Sprint 3.
export interface FitLevel<TCoord> {
  readonly topology: TopologyId;
  readonly figure: BoardShape<TCoord>;
  readonly pieces: readonly Piece<PieceId, TCoord>[];
}

// Abstract Factory (classes.md decision 31): the whole family of one Hexa Fit level.
// The geometry comes by composition (APP-FR-16, D11).
// A level runs only on the figure that its `topology` names (S3-08).
// `TimedRulesDecorator` is Sprint 3 work (D14), so the rules are the plain `FitRules` today.
export class FitFactory<TCoord> implements IVariantFactory<
  PieceId,
  TCoord,
  FitMove<TCoord>,
  FitState<TCoord>
> {
  readonly gameId = GameId.of('hexa-fit');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly level: FitLevel<TCoord>,
  ) {
    // A level file has no compile-time types, so the check runs when the game starts.
    if (level.topology !== geometry.id) {
      throw new RangeError(
        `A Fit level of topology ${level.topology} cannot start on the ${geometry.id} geometry.`,
      );
    }
  }

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
  // `BoardBuilder` takes the figure as a tree of cells.
  createBoard(): Board<PieceId, TCoord, string> {
    const figure = new ShapeGroup(this.level.figure.cells.map((c) => new CellNode(c)));
    return new BoardBuilder(this.geometry).withFigure(figure).build<PieceId>();
  }

  createInitialState(): FitState<TCoord> {
    return FitState.start(this.createBoard(), this.createPieceSource());
  }

  // Hexa Fit undoes with no limit (APP-FR-08, classes.md decision 3).
  // `RedoableHistory` adds the redo of Hexa Fit in Sprint 3.
  createHistory(): MoveHistory<FitMove<TCoord>, FitState<TCoord>> {
    return new MoveHistory();
  }
}
