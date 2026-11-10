import type { Board } from '../../engine/board';
import type { BoardId } from '../../engine/board-id';
import { BoardBuilder } from '../../engine/board-builder';
import { GameId } from '../../engine/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { GeometryFactory } from '../../engine/geometry-factory';
import type { MatchId } from '../../engine/match-id';
import type { Piece } from '../../engine/piece';
import type { IPieceSource } from '../../engine/piece-source';
import type { RegionSize } from '../../engine/region-size';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { IVariantFactory } from '../../engine/variant-factory';
import type { ColorStack } from './color-stack';
import type { GoalCount } from './goal-count';
import { SortRules } from './sort-rules';
import { SortScoring } from './sort-scoring';
import type { PlaceStack } from './place-stack';
import { SortState } from './sort-state';

// One Hexa Sort level: the board region, the source of its stacks and its goal.
// The goal is a `GoalCount`, so a level cannot ask for 0 goals (issue #129).
// The level picks a seeded source or a fixed list (A4). `SortLevelBuilder` builds it in Sprint 3.
export interface SortLevel<TCoord> {
  readonly size: RegionSize;
  readonly source: IPieceSource<Piece<ColorStack, TCoord>>;
  readonly goalsNeeded: GoalCount;
}

// Abstract Factory (classes.md decision 31): the whole family of one Hexa Sort level.
// The geometry comes by composition (APP-FR-16, D11), so the factory runs on any figure.
export class SortFactory<TCoord> implements IVariantFactory<
  ColorStack,
  TCoord,
  PlaceStack<TCoord>,
  SortState<TCoord>
> {
  readonly gameId = GameId.of('hexa-sort');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly level: SortLevel<TCoord>,
  ) {}

  createRules(): IGameRules<PlaceStack<TCoord>, SortState<TCoord>> {
    return new SortRules<TCoord>();
  }

  createScoring(): IScoringPolicy<SortState<TCoord>> {
    return new SortScoring<TCoord>();
  }

  // Prototype (classes.md decision 7): a clone of the level source at its position.
  // So each game draws the same stacks, and the level source stays unread.
  createPieceSource(): IPieceSource<Piece<ColorStack, TCoord>> {
    return this.level.source.clone();
  }

  createBoard(boardId: BoardId): Board<ColorStack, TCoord, string> {
    return new BoardBuilder(this.geometry).withRegion(this.level.size).build<ColorStack>(boardId);
  }

  createInitialState(matchId: MatchId, stateId: GameStateId, boardId: BoardId): SortState<TCoord> {
    return SortState.start({
      stateId,
      matchId,
      board: this.createBoard(boardId),
      source: this.createPieceSource(),
      goalsNeeded: this.level.goalsNeeded,
    });
  }

  // Hexa Sort has no undo (APP-FR-08, classes.md decision 3).
  createHistory(): undefined {
    return undefined;
  }
}
