import type { GameRepository } from '../application/game-repository';
import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameEngine } from '../domain/engine/game-engine';

// Adapter of the `GameRepository` port: the repository of the game aggregate
// (classes.md decisions 10 and 52, issue #162). It keeps zero or one root in memory.
// The composition root builds one repository for each registered game, so two games
// of different variants never share a running game.
// It saves and gives back the whole root, `GameEngine`, and never copies it.
// Only the game use cases of layer 2 read it. A presenter gets a plain `MoveResult`.
export class InMemoryGameRepository<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements GameRepository<TCell, TCoord, TMove, TState> {
  private game: GameEngine<TCell, TCoord, TMove, TState> | undefined;

  current(): GameEngine<TCell, TCoord, TMove, TState> | undefined {
    return this.game;
  }

  replace(game: GameEngine<TCell, TCoord, TMove, TState>): void {
    this.game = game;
  }
}
