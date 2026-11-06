import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameEngine } from '../domain/engine/game-engine';

// Output port (classes.md decision 10, proposal). It keeps the running engine between
// two calls of the game use cases. It is the repository of the aggregate root (decision 26).
// `InMemoryRunningGameStore` in layer 3 implements it.
export interface RunningGameStore<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  current(): GameEngine<TCell, TCoord, TMove, TState> | undefined;
  replace(game: GameEngine<TCell, TCoord, TMove, TState>): void;
}
