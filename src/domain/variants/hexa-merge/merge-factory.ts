import type { Board } from '../../engine/board';
import type { BoardId } from '../../engine/board-id';
import { BoardBuilder } from '../../engine/board-builder';
import { GameId } from '../../engine/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { GeometryFactory } from '../../engine/geometry-factory';
import type { MatchId } from '../../engine/match-id';
import { MoveHistory } from '../../engine/move-history';
import type { SeededPieceSource } from '../../engine/piece-source';
import type { RegionSize } from '../../engine/region-size';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { IVariantFactory } from '../../engine/variant-factory';
import { MergeRules } from './merge-rules';
import { MergeScoring } from './merge-scoring';
import { MergeState, type MergeSnapshot } from './merge-state';
import type { MergeTile } from './merge-tile';
import { mergeTileSource } from './merge-tile-source';
import type { NewTile } from './new-tile';
import type { Slide } from './slide';

// The count of tiles on the first board. Statement §1.4 does not give it.
// The value follows 2048, as the chance of a 4 does (issue 57): two tiles.
export const START_TILES = 2;

// The count of moves that the Merge history keeps (statement §5.1.8, APP-FR-08).
export const MERGE_UNDO_LIMIT = 1;

// The settings of one Hexa Merge game. `fourChance` defaults to `DEFAULT_FOUR_CHANCE`.
export interface MergeSettings {
  readonly size: RegionSize;
  readonly seed: number;
  readonly target: MergeTile;
  readonly fourChance?: number;
}

// Abstract Factory (classes.md decision 31): the whole family of Hexa Merge.
// The bound `IMergeable` of `MergeRules` is bound here to `MergeTile` (decision 8).
// The piece source gives `NewTile` draws, so the factory binds `TPiece` to `NewTile<MergeTile>`.
// The geometry comes by composition (APP-FR-16, D11), so the factory runs on any figure.
// The contract of the geometry names its axes as `string`, so the slides do too.
// The seed comes by injection (R-domain-determinism).
export class MergeFactory<TCoord> implements IVariantFactory<
  MergeTile,
  TCoord,
  Slide<string>,
  MergeState<MergeTile, TCoord, string>,
  NewTile<MergeTile>
> {
  readonly gameId = GameId.of('hexa-merge');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly settings: MergeSettings,
  ) {}

  createRules(): IGameRules<Slide<string>, MergeState<MergeTile, TCoord, string>> {
    return new MergeRules<MergeTile, TCoord, string>(this.settings.target);
  }

  createScoring(): IScoringPolicy<MergeState<MergeTile, TCoord, string>> {
    return new MergeScoring<TCoord, string>();
  }

  createPieceSource(): SeededPieceSource<NewTile<MergeTile>> {
    return mergeTileSource(this.settings.seed, this.settings.fourChance);
  }

  createBoard(boardId: BoardId): Board<MergeTile, TCoord, string> {
    return new BoardBuilder(this.geometry).withRegion(this.settings.size).build<MergeTile>(boardId);
  }

  // The first tiles come from the same source as the later tiles.
  createInitialState(
    matchId: MatchId,
    stateId: GameStateId,
    boardId: BoardId,
  ): MergeState<MergeTile, TCoord, string> {
    const state = new MergeState(
      stateId,
      matchId,
      this.createBoard(boardId),
      this.createPieceSource(),
    );
    for (let i = 0; i < START_TILES; i += 1) state.addNewTile();
    return state;
  }

  // Hexa Merge undoes one move (APP-FR-08, classes.md decision 3).
  createHistory(): MoveHistory<Slide<string>, MergeSnapshot<MergeTile, TCoord, string>> {
    return new MoveHistory(MERGE_UNDO_LIMIT);
  }
}
