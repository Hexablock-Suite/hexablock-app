import type { Board } from '../../engine/board';
import type { BoardId } from '../../engine/board-id';
import { BoardBuilder } from '../../engine/board-builder';
import type { Clock } from '../../engine/clock';
import { GameId } from '../../engine/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { GeometryFactory } from '../../engine/geometry-factory';
import { LevelTimer } from '../../engine/level-timer';
import type { MatchId } from '../../engine/match-id';
import { MoveHistory } from '../../engine/move-history';
import type { Piece } from '../../engine/piece';
import { FixedListPieceSource } from '../../engine/piece-source';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import { TimedRulesDecorator } from '../../engine/timed-rules-decorator';
import type { IVariantFactory } from '../../engine/variant-factory';
import type { FitLevel } from './fit-level';
import type { FitMove } from './fit-move';
import { FitRules } from './fit-rules';
import { FitScoring } from './fit-scoring';
import { FitState, type FitSnapshot } from './fit-state';
import type { PieceId } from './piece-id';

// Abstract Factory (classes.md decision 31): the whole family of one Hexa Fit level.
// The geometry comes by composition (APP-FR-16, D11).
// A level runs only on the figure that its `topology` names (S3-08).
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
    private readonly clock: Clock,
  ) {
    // A level file has no compile-time types, so the check runs when the game starts.
    // The level checks itself when it is created (classes.md decision 46).
    // Only this check needs the geometry, so the factory keeps it and asks the level.
    if (!level.isOf(geometry.id)) throw level.wrongFamily(geometry.id);
  }

  // Fit stars use time (D14, classes.md decision 19). `FitRules` holds no timer code.
  // Each call gives a new timer, so two games share only the `Clock`.
  createRules(): IGameRules<FitMove<TCoord>, FitState<TCoord>> {
    return new TimedRulesDecorator(new FitRules<TCoord>(), new LevelTimer(this.clock));
  }

  createScoring(): IScoringPolicy<FitState<TCoord>> {
    return new FitScoring<TCoord>();
  }

  // A finite source of the level pieces, so the Fit tray is finite (classes.md decision 32).
  createPieceSource(): FixedListPieceSource<Piece<PieceId, TCoord>> {
    return new FixedListPieceSource(this.level.trayPieces());
  }

  // The board is the figure: its shape holds only the figure cells.
  // `BoardBuilder` takes the figure as a tree of cells, and the level gives that tree.
  createBoard(boardId: BoardId): Board<PieceId, TCoord> {
    return new BoardBuilder(this.geometry)
      .withFigure(this.level.figureTree())
      .build<PieceId>(boardId);
  }

  createInitialState(matchId: MatchId, stateId: GameStateId, boardId: BoardId): FitState<TCoord> {
    return FitState.start(stateId, matchId, this.createBoard(boardId), this.createPieceSource());
  }

  // Hexa Fit undoes with no limit (APP-FR-08, classes.md decision 3).
  // `RedoableHistory` adds the redo of Hexa Fit in Sprint 3.
  createHistory(): MoveHistory<FitMove<TCoord>, FitSnapshot<TCoord>> {
    return new MoveHistory();
  }
}
