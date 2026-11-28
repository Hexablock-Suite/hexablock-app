import type { Board } from '../../engine/board/board';
import type { BoardId } from '../../engine/board/board-id';
import { BoardBuilder } from '../../engine/board/board-builder';
import type { Clock } from '../../engine/turn/clock';
import { GameId } from '../../shared/game-id';
import type { GameStateId } from '../../engine/board/game-state-id';
import type { GeometryFactory } from '../../engine/geometry/geometry-factory';
import { LevelProgress } from '../../progress/level-progress';
import { LevelTimer } from '../../engine/turn/level-timer';
import { LevelTimerId } from '../../engine/turn/level-timer-id';
import type { MatchId } from '../../engine/match-id';
import type { Piece } from '../../engine/board/piece';
import { FixedListPieceSource } from '../../engine/random/piece-source';
import { RedoableHistory } from '../../engine/history/redoable-history';
import type { IGameRules } from '../../engine/turn/rules';
import type { IScoringPolicy } from '../../engine/turn/scoring-policy';
import type { IVariantFactory } from '../../engine/factory/variant-factory';
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
  private readonly gameId = GameId.of('hexa-fit');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly level: FitLevel<TCoord>,
    private readonly clock: Clock,
  ) {
    // A level file has no compile-time types, so the check runs when the game starts.
    // The level checks itself when it is created (classes.md decision 46).
    // Only this check needs the geometry, so the factory keeps it and asks the level.
    if (!level.runsOn(geometry)) throw level.wrongFamily(geometry);
  }

  // True when `gameId` names Hexa Fit. The id stays private (issue #234).
  isFor(gameId: GameId): boolean {
    return this.gameId.equals(gameId);
  }

  // `FitRules` holds no timer code. `GameFactory` wraps the rules in `TimedRulesDecorator`
  // with the timer of `createTimer()` (classes.md decision 19).
  createRules(): IGameRules<FitMove<TCoord>, FitState<TCoord>> {
    return new FitRules<TCoord>();
  }

  // Fit stars use time (D14, classes.md decision 19). Each call gives a new timer,
  // so two games share only the `Clock`. The timer is an entity (classes.md decision 26).
  // Its id is local (decision 52): the factory builds the `LevelTimerId` from the `MatchId`.
  createTimer(matchId: MatchId): LevelTimer {
    return new LevelTimer(LevelTimerId.of(matchId), this.clock);
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

  // Hexa Fit undoes and redoes with no limit (APP-FR-08, classes.md decisions 3 and 4, #178).
  createHistory(): RedoableHistory<FitMove<TCoord>, FitSnapshot<TCoord>> {
    return new RedoableHistory();
  }

  // Hexa Fit keeps the best result of each level. The level counts the stars of a play
  // by its moves and its time (D20, classes.md decision 36), so the model counts by both (#424).
  createProgressModel(): LevelProgress {
    return LevelProgress.byMovesAndTime(this.level);
  }
}
