import { Board } from '../../engine/board';
import { GameId } from '../../engine/game-id';
import type { GridTopology } from '../../engine/grid-topology';
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
import { SortState, type PlaceStack } from './sort-state';

// One Hexa Sort level: the board region, the source of its stacks and its goal.
// The goal is a `GoalCount`, so a level cannot ask for 0 goals (issue #129).
// The level picks a seeded source or a fixed list (A4). `SortLevelBuilder` builds it in Sprint 3.
export interface SortLevel<TCoord> {
  readonly size: RegionSize;
  readonly source: IPieceSource<Piece<ColorStack, TCoord>>;
  readonly goalsNeeded: GoalCount;
}

// Abstract Factory (classes.md decision 31): the whole family of one Hexa Sort level.
// The topology is the geometry seam. `GeometryFactory<TCoord>` replaces it in Sprint 3
// (APP-FR-16, D11).
export class SortFactory<TCoord> implements IVariantFactory<
  ColorStack,
  TCoord,
  PlaceStack<TCoord>,
  SortState<TCoord>
> {
  readonly gameId = GameId.of('hexa-sort');

  constructor(
    private readonly topology: GridTopology<TCoord, string, string>,
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

  createBoard(): Board<ColorStack, TCoord, string> {
    return new Board<ColorStack, TCoord, string>(
      this.topology.region(this.level.size),
      this.topology,
    );
  }

  createInitialState(): SortState<TCoord> {
    return SortState.start({
      board: this.createBoard(),
      source: this.createPieceSource(),
      goalsNeeded: this.level.goalsNeeded,
    });
  }
}
