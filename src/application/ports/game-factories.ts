import type { BoardState } from '../../domain/engine/board/board-state';
import type { Cloneable } from '../../domain/engine/cloneable';
import type { GameFactory } from '../../domain/engine/factory/game-factory';
import type { LevelId } from '../../domain/progress/level-id';

// Output port of the factories of one game (S3-13 in #151, option D, issue #172).
// It gives `StartGame` the `GameFactory` of the level that the player chose.
// A level is a level file, so the factory of a level comes from the level repository
// and the level builder of the variant. That code knows the variants, so it lives
// in an adapter of layer 3: `LevelGameFactories` implements this port.
// So `StartGame` keeps the choice of the level and never names a variant (decision 31).
// The composition root builds one `StartGame` for each game, and that `StartGame`
// starts every level of the game through this port.
export interface GameFactories<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  // The factory of the new games of the level `levelId`. With no level id, the factory
  // of the game that the composition root registered. A game with no levels starts so.
  // The promise rejects a level id that the game does not have.
  factoryFor(levelId?: LevelId): Promise<GameFactory<TCell, TCoord, TMove, TState>>;
}
