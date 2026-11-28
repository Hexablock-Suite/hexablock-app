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
import {
  FixedListPieceSource,
  SeededPieceSource,
  type IPieceSource,
} from '../../engine/random/piece-source';
import type { RandomSource } from '../../engine/random/random-source';
import type { IGameRules } from '../../engine/turn/rules';
import type { IScoringPolicy } from '../../engine/turn/scoring-policy';
import type { IVariantFactory } from '../../engine/factory/variant-factory';
import type { ColorStack } from './color-stack';
import type { SortLevel } from './sort-level';
import { SortRules } from './sort-rules';
import { SortScoring } from './sort-scoring';
import type { PlaceStack } from './place-stack';
import { SortState } from './sort-state';

// Abstract Factory (classes.md decision 31): the whole family of one Hexa Sort level.
// The piece source gives `ColorStack` draws, so the factory binds `TPiece` to `ColorStack`,
// as Hexa Merge binds it to `NewTile` (classes.md decision 6, issue #423). A stack has no shape:
// the player names the cell of each placement.
// The geometry comes by composition (APP-FR-16, D11), so the factory runs on any figure.
// The random source comes by injection (R-domain-determinism, classes.md decision 25).
// A level seeded each match draws a new seed from it in each match (issue #417).
// A level file names its seed or its stacks, so the factory draws nothing for it.
// The clock times each level (issue #46): the backend asks for the time of each level result
// (DS-5), though Sort gives no star by time (D22).
export class SortFactory<TCoord> implements IVariantFactory<
  ColorStack,
  TCoord,
  PlaceStack<TCoord>,
  SortState<TCoord>,
  ColorStack
> {
  private readonly gameId = GameId.of('hexa-sort');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly level: SortLevel,
    private readonly random: RandomSource,
    private readonly clock: Clock,
  ) {}

  // True when `gameId` names Hexa Sort. The id stays private (issue #234).
  isFor(gameId: GameId): boolean {
    return this.gameId.equals(gameId);
  }

  createRules(): IGameRules<PlaceStack<TCoord>, SortState<TCoord>> {
    return new SortRules<TCoord>();
  }

  // Hexa Sort times each level as Hexa Fit does (classes.md decision 19, issue #46).
  // `GameFactory` wraps the rules in `TimedRulesDecorator` with this timer. The time ranks two
  // plays with equal stars and moves (DS-4), and the sync sends it (DS-5). It gives no star.
  // Each call gives a new timer with a local id from the `MatchId` (decision 52).
  createTimer(matchId: MatchId): LevelTimer {
    return new LevelTimer(LevelTimerId.of(matchId), this.clock);
  }

  createScoring(): IScoringPolicy<SortState<TCoord>> {
    return new SortScoring<TCoord>();
  }

  // A new source for each game, built from the data of the level (classes.md decision 47).
  // The level holds no source: it gives its seed and its draw, its draw alone,
  // or its fixed list of stacks. A level with a seed or a fixed list gives the same stacks
  // in every game. A level seeded each match takes a new seed of the random source in each game.
  // No game moves the source of another.
  createPieceSource(): IPieceSource<ColorStack> {
    return this.level.sourceWith<IPieceSource<ColorStack>>({
      seeded: (seed, draw) => new SeededPieceSource(seed, draw),
      seededEachMatch: (draw) => new SeededPieceSource(this.random.next().pickSeed(), draw),
      fixed: (stacks) => new FixedListPieceSource(stacks),
    });
  }

  createBoard(boardId: BoardId): Board<ColorStack, TCoord> {
    return new BoardBuilder(this.geometry)
      .withRegion(this.level.boardSize())
      .build<ColorStack>(boardId);
  }

  createInitialState(matchId: MatchId, stateId: GameStateId, boardId: BoardId): SortState<TCoord> {
    return SortState.start({
      stateId,
      matchId,
      board: this.createBoard(boardId),
      source: this.createPieceSource(),
      goalsNeeded: this.level.goal(),
    });
  }

  // Hexa Sort has no undo (APP-FR-08, classes.md decision 3).
  createHistory(): undefined {
    return undefined;
  }

  // Hexa Sort keeps the best result of each level. The level counts the stars of a play
  // by its moves (D22, classes.md decision 36), so the model counts by the moves only (#424).
  createProgressModel(): LevelProgress {
    return LevelProgress.byMoves(this.level);
  }
}
