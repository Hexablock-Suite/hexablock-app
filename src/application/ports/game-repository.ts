import type { BoardState } from '../../domain/engine/board/board-state';
import type { Cloneable } from '../../domain/engine/cloneable';
import type { GameEngine } from '../../domain/engine/turn/game-engine';

// Output port and repository of the game aggregate (classes.md decisions 10 and 52).
// It saves and gives back the whole aggregate root, `GameEngine` (decision 26).
// No internal entity of the aggregate has a repository.
// The game use cases ask only for the running game, so the port has no search by an id.
// `InMemoryGameRepository` in layer 3 implements it and keeps the root in memory.
export interface GameRepository<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  // Gives back the saved root, or `undefined` when no game runs.
  current(): GameEngine<TCell, TCoord, TMove, TState> | undefined;
  // Saves the root in place of the root that the repository holds.
  replace(game: GameEngine<TCell, TCoord, TMove, TState>): void;
}
