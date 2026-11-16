import type { BoardState } from '../domain/engine/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameId } from '../domain/engine/game-id';
import type { IVariantFactory } from '../domain/engine/variant-factory';

// What a caller does with the variant factory of one registered game.
// The registry holds variants with different type arguments, so it hides them.
// `use()` gets the type of the state back for one call, so the factory, its history
// and its states keep one state type. The cell, the coordinate, the move and the piece
// stay open: a caller only passes them on.
export interface FactoryUse<TResult> {
  use<TState extends BoardState<unknown, unknown> & Cloneable<TState>>(
    factory: IVariantFactory<unknown, unknown, unknown, TState, unknown>,
  ): TResult;
}

// One game of the registry: its id and its variant factory, with the type arguments hidden.
// The state mapper of the game (#170) and its cell renderer (#165, S3-07) join it later.
export interface RegisteredGame {
  readonly gameId: GameId;
  withFactory<TResult>(use: FactoryUse<TResult>): TResult;
}

// The registered game of `factory`. The factory declares its own id (classes.md decision 30),
// so the entry keeps no second id.
export function registered<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>): RegisteredGame {
  return Object.freeze({
    gameId: factory.gameId,
    withFactory: <TResult>(use: FactoryUse<TResult>) => use.use(factory),
  });
}

// The game registry of the composition root (step 10 of docs/EXTENSIBILITY.md, issue #162).
// It maps each `GameId` to its game, so a fifth variant adds one entry.
// The game selector reads its ids (#169).
// Two games with one id throw a RangeError, because one id must pick one game.
export class GameRegistry {
  private readonly games: readonly RegisteredGame[];

  constructor(games: readonly RegisteredGame[]) {
    games.forEach((game, index) => {
      if (games.slice(0, index).some((earlier) => earlier.gameId.equals(game.gameId))) {
        throw new RangeError('The registry holds two games with one id.');
      }
    });
    this.games = Object.freeze([...games]);
  }

  // The ids of the registered games, in the order of registration.
  gameIds(): GameId[] {
    return this.games.map((game) => game.gameId);
  }

  // The registered game with the id `gameId`.
  // An id that the registry does not hold throws a RangeError.
  gameOf(gameId: GameId): RegisteredGame {
    const game = this.games.find((candidate) => candidate.gameId.equals(gameId));
    if (game === undefined) throw new RangeError('The registry holds no game with this id.');
    return game;
  }
}
