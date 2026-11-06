import { ApplyMove } from '../../../src/application/apply-move';
import type { Result, UseCaseError } from '../../../src/application/result';
import type { RunningGameStore } from '../../../src/application/running-game-store';
import { StartGame } from '../../../src/application/start-game';
import type { BoardState } from '../../../src/domain/engine/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import type { GameEngine } from '../../../src/domain/engine/game-engine';
import type { GameEventPublisher } from '../../../src/domain/engine/game-events';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import { RecordingPublisher } from '../engine/fake-game';

// Helpers for the game use case tests. They exist only in test/.

// A test double of the `RunningGameStore` port. It keeps zero or one engine in memory.
// `InMemoryRunningGameStore` of layer 3 comes with the composition root.
export class MemoryRunningGameStore<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements RunningGameStore<TCell, TCoord, TMove, TState> {
  private game: GameEngine<TCell, TCoord, TMove, TState> | undefined;

  current(): GameEngine<TCell, TCoord, TMove, TState> | undefined {
    return this.game;
  }

  replace(game: GameEngine<TCell, TCoord, TMove, TState>): void {
    this.game = game;
  }

  // The running engine. A test that expects a game and finds none fails here.
  running(): GameEngine<TCell, TCoord, TMove, TState> {
    if (this.game === undefined) throw new RangeError('No game is running.');
    return this.game;
  }
}

// The two game use cases of one variant over one shared store.
export function gameUseCases<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(
  factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>,
  events: GameEventPublisher = new RecordingPublisher(),
) {
  const games = new MemoryRunningGameStore<TCell, TCoord, TMove, TState>();
  return {
    games,
    startGame: new StartGame(factory, games, events),
    applyMove: new ApplyMove(games),
  };
}

// The value of a success. A failure fails the test with its error code.
export function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new RangeError(`Expected a success, got ${result.error.code}.`);
  return result.value;
}

// The error of a failure. A success fails the test.
export function errorOf<T>(result: Result<T>): UseCaseError {
  if (result.ok) throw new RangeError('Expected a failure, got a success.');
  return result.error;
}
