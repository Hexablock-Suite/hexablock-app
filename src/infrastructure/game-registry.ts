import type { MoveMapper } from '../adapters/move-mapper';
import type { StateMapper } from '../adapters/state-mapper';
import type { ViewOf } from '../application/move-result';
import type { BoardState } from '../domain/engine/board/board-state';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameId } from '../domain/shared/game-id';
import type { LevelVariant } from '../domain/engine/factory/level-variant';
import type { IVariantFactory } from '../domain/engine/factory/variant-factory';
import type { BoardLayout } from '../adapters/board/board-layout';
import type { CellRenderer } from './board/cell-renderer';
import type { MoveControls } from './ui/move-controls';
import type { WorldTone } from './ui/theme';

// What a caller does with the id, the variant factory and the level variant of one registered game.
// The registry holds variants with different type arguments, so it hides them.
// `use()` gets the type of the state back for one call, so the factory, its history
// and its states keep one state type. The cell, the coordinate, the move and the piece
// stay open: a caller only passes them on.
// `use()` gets the id with its factory, so a caller never pairs them again (issue #234).
// It also gets the `LevelVariant` of a game with levels, which builds the variant factory
// of each level of the game with the same state type, or `undefined` (issue #172).
export interface FactoryUse<TResult> {
  use<TState extends BoardState<unknown, unknown> & Cloneable<TState>>(
    gameId: GameId,
    factory: IVariantFactory<unknown, unknown, unknown, TState, unknown>,
    levels: LevelVariant<unknown, unknown, unknown, TState> | undefined,
  ): TResult;
}

// The parts of the game screen that one game chooses (classes.md decision 14, issue #170,
// S3-07 in #151, «Propuesta, pendiente del equipo»): the state mapper of layer 3, the cell
// renderer of layer 4, the move controls of layer 4 (#175), the move mapper of layer 3 (#405)
// and the layout of layer 3 of the board figure for a cell size in density-independent pixels.
// The mapper and the renderer name one `TCellView`.
// The layout names the coordinate of the factory, so the figure and the factory stay paired.
// The controls read the cell views and the payload view of the mapper and send a `TIntent`.
// The move mapper turns that intent into the move of the factory.
export interface ScreenParts<
  TCell,
  TCoord,
  TView,
  TCellView,
  TPayloadView,
  TMove = unknown,
  TIntent = unknown,
> {
  readonly mapper: StateMapper<TCell, TView, TCellView, TPayloadView>;
  readonly renderer: CellRenderer<TCellView>;
  readonly controls: MoveControls<TCoord, TCellView, TPayloadView, TIntent>;
  readonly moves: MoveMapper<TIntent, TMove>;
  layoutOf(size: number): BoardLayout<TCoord>;
}

// One game of the registry: its id, its variant factory, its optional level variant,
// its screen parts and its world colors, with the type arguments hidden.
// `hasLevels` tells whether the game has a level variant. The map opens the level selector
// for a game with levels, and the game route for a game with none (#173).
// The map draws the stone of the game in `tone` on every figure (#298), so a game keeps its
// color when the list of a figure has no entry for another game. `registered()` checks that the parts fit the factory,
// so a screen only passes the cell views of the mapper to the renderer of the same entry.
export interface RegisteredGame {
  readonly gameId: GameId;
  readonly screen: ScreenParts<unknown, unknown, unknown, unknown, unknown, unknown, unknown>;
  readonly tone: WorldTone;
  readonly hasLevels: boolean;
  withFactory<TResult>(use: FactoryUse<TResult>): TResult;
}

// The registered game `gameId` with the variant factory `factory`, the screen parts `screen`
// and the world colors `tone` of the game on the map (#298). The colors are required,
// so the type checker makes a fifth variant declare its own. This is the one place that pairs a `GameId` with its factory. The factory keeps
// its id private and answers `isFor()` (classes.md decision 30, issue #234), and `GameFactory`
// cannot check the pair, because the engine never branches on a game id. So the entry asks
// the factory here. A factory that does not build the game of `gameId` throws a RangeError.
// The mapper of `screen` reads the cell and the payload of the states of `factory`, and its
// layout places the coordinates of that factory (#170). Its controls send the intents that
// its move mapper turns into the moves of that factory (#175, #405).
// A game with levels also takes `levels`, the `LevelVariant` that builds the variant factory
// of each level. Its type arguments are those of `factory`, so the two give one state type (#172).
export function registered<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
  TCellView,
  TPayloadView,
  TIntent,
>(
  gameId: GameId,
  factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>,
  screen: ScreenParts<TCell, TCoord, ViewOf<TState>, TCellView, TPayloadView, TMove, TIntent>,
  tone: WorldTone,
  levels?: LevelVariant<TCell, TCoord, TMove, TState>,
): RegisteredGame {
  if (!factory.isFor(gameId)) {
    throw new RangeError('The factory does not build the game of this id.');
  }
  return Object.freeze({
    gameId,
    screen,
    tone,
    hasLevels: levels !== undefined,
    withFactory: <TResult>(use: FactoryUse<TResult>) => use.use(gameId, factory, levels),
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
