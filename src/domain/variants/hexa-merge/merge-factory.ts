import type { Board } from '../../engine/board';
import type { BoardId } from '../../engine/board-id';
import { BoardBuilder } from '../../engine/board-builder';
import { GameId } from '../../engine/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { GeometryFactory } from '../../engine/geometry-factory';
import type { GridAxis } from '../../engine/grid-topology';
import type { MatchId } from '../../engine/match-id';
import { MoveHistory } from '../../engine/move-history';
import type { SeededPieceSource } from '../../engine/piece-source';
import type { RegionSize } from '../../engine/region-size';
import type { IGameRules } from '../../engine/rules';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { Seed } from '../../engine/seed';
import type { IVariantFactory } from '../../engine/variant-factory';
import type { Chance } from './chance';
import { MergeRules } from './merge-rules';
import { MergeScoring } from './merge-scoring';
import { MergeState, type MergeSnapshot } from './merge-state';
import type { MergeTile } from './merge-tile';
import { DEFAULT_FOUR_CHANCE, mergeTileSource } from './merge-tile-source';
import type { NewTile } from './new-tile';
import type { Slide } from './slide';

// The count of tiles on the first board. Statement §1.4 does not give it.
// The value follows 2048, as the chance of a 4 does (issue 57): two tiles.
export const START_TILES = 2;

// The count of moves that the Merge history keeps (statement §5.1.8, APP-FR-08).
export const MERGE_UNDO_LIMIT = 1;

// The settings of one Hexa Merge game: the board region, the seed of the new tiles,
// the target tile and the chance that a new tile is a 4.
// It is a value object (classes.md decision 48, issue #210), in the form of `FitLevel`:
// it never changes, its fields are private, and two settings are equal when their parts are equal.
// An object literal is no longer the settings of a game.
// Each part is a value object that checks itself, so settings with a wrong seed
// or a wrong chance cannot exist. `fourChance` defaults to `DEFAULT_FOUR_CHANCE`.
export class MergeSettings {
  private constructor(
    private readonly size: RegionSize,
    private readonly seed: Seed,
    private readonly target: MergeTile,
    private readonly fourChance: Chance,
  ) {
    Object.freeze(this);
  }

  static of(
    size: RegionSize,
    seed: Seed,
    target: MergeTile,
    fourChance: Chance = DEFAULT_FOUR_CHANCE,
  ): MergeSettings {
    return new MergeSettings(size, seed, target, fourChance);
  }

  // The size of the board region of the game.
  boardSize(): RegionSize {
    return this.size;
  }

  // The seed of the source of the new tiles.
  tileSeed(): Seed {
    return this.seed;
  }

  // The tile that the player tries to make.
  targetTile(): MergeTile {
    return this.target;
  }

  // The chance that a new tile is a 4.
  chanceOfFour(): Chance {
    return this.fourChance;
  }

  // Two settings are equal when they hold the same size, the same seed, the same target
  // and the same chance of a 4.
  equals(other: MergeSettings): boolean {
    return (
      this.size.equals(other.size) &&
      this.seed.equals(other.seed) &&
      this.target.equals(other.target) &&
      this.fourChance.equals(other.fourChance)
    );
  }
}

// Abstract Factory (classes.md decision 31): the whole family of Hexa Merge.
// The bound `IMergeable` of `MergeRules` is bound here to `MergeTile` (decision 8).
// The piece source gives `NewTile` draws, so the factory binds `TPiece` to `NewTile<MergeTile>`.
// The geometry comes by composition (APP-FR-16, D11), so the factory runs on any figure.
// The contract of the geometry gives a topology with any axis, so a slide takes any `GridAxis`.
// The seed comes by injection (R-domain-determinism).
export class MergeFactory<TCoord> implements IVariantFactory<
  MergeTile,
  TCoord,
  Slide<GridAxis>,
  MergeState<MergeTile, TCoord, GridAxis>,
  NewTile<MergeTile>
> {
  readonly gameId = GameId.of('hexa-merge');

  constructor(
    private readonly geometry: GeometryFactory<TCoord>,
    private readonly settings: MergeSettings,
  ) {}

  createRules(): IGameRules<Slide<GridAxis>, MergeState<MergeTile, TCoord, GridAxis>> {
    return new MergeRules<MergeTile, TCoord, GridAxis>(this.settings.targetTile());
  }

  createScoring(): IScoringPolicy<MergeState<MergeTile, TCoord, GridAxis>> {
    return new MergeScoring<TCoord, GridAxis>();
  }

  createPieceSource(): SeededPieceSource<NewTile<MergeTile>> {
    return mergeTileSource(this.settings.tileSeed(), this.settings.chanceOfFour());
  }

  createBoard(boardId: BoardId): Board<MergeTile, TCoord> {
    return new BoardBuilder(this.geometry)
      .withRegion(this.settings.boardSize())
      .build<MergeTile>(boardId);
  }

  // The first tiles come from the same source as the later tiles.
  createInitialState(
    matchId: MatchId,
    stateId: GameStateId,
    boardId: BoardId,
  ): MergeState<MergeTile, TCoord, GridAxis> {
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
  createHistory(): MoveHistory<Slide<GridAxis>, MergeSnapshot<MergeTile, TCoord, GridAxis>> {
    return new MoveHistory(MERGE_UNDO_LIMIT);
  }
}
