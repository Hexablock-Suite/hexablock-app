import { InMemoryGameRepository } from '../adapters/in-memory-game-repository';
import { NullGameEventPublisher } from '../adapters/null-game-event-publisher';
import { ApplyMove, type ApplyMoveRequest } from '../application/apply-move';
import type { GameEventPublisher } from '../application/game-event-publisher';
import type { Logger } from '../application/logger';
import { LoggingAspect } from '../application/logging-aspect';
import type { MoveResult, ViewOf } from '../application/move-result';
import { StartGame, type StartGameRequest } from '../application/start-game';
import { UndoMove, type UndoMoveRequest } from '../application/undo-move';
import type { UseCase } from '../application/use-case';
import type { BoardState } from '../domain/engine/board-state';
import type { Clock } from '../domain/engine/clock';
import type { Cloneable } from '../domain/engine/cloneable';
import { GameFactory } from '../domain/engine/game-factory';
import type { GameId } from '../domain/engine/game-id';
import type { MatchIdGenerator } from '../domain/engine/match-id-generator';
import type { IVariantFactory } from '../domain/engine/variant-factory';
import { ConsoleLogger } from './console-logger';
import { GameRegistry, type RegisteredGame } from './game-registry';
import { registeredGames } from './registered-games';
import { SeededRandomSource } from './seeded-random-source';
import { SequentialMatchIds } from './sequential-match-ids';
import { SystemClock } from './system-clock';

// The game use cases of one game. Each one is behind the `UseCase` input port (decision 9)
// and inside the logging aspect, so a presenter never sees a concrete use case.
// `TView` is the variant data of the response (decision 29).
export interface GameUseCases<TCell = unknown, TCoord = unknown, TMove = unknown, TView = unknown> {
  readonly startGame: UseCase<StartGameRequest, MoveResult<TCell, TCoord, TView>>;
  readonly applyMove: UseCase<ApplyMoveRequest<TMove>, MoveResult<TCell, TCoord, TView>>;
  readonly undoMove: UseCase<UndoMoveRequest, MoveResult<TCell, TCoord, TView>>;
}

// The drivers that a test may replace. The app takes the system clock and the console logger.
export interface RootDrivers {
  readonly clock: Clock;
  readonly logger: Logger;
}

// The composition root (layers.md, Q9, S3-06 in #151, issue #162). It is the only place
// that imports from every layer. `app/_layout.tsx` only calls it, through
// `CompositionRootProvider`, so `app/` keeps routes only.
// It builds each driver and adapter once and injects it (single scope, classes.md decision 18):
// the clock, the random source, the logger, the one id generator of `MatchId`
// and the event publisher. No class has a static `instance()`, so a test passes its own drivers.
// The game registry maps each `GameId` to its game and the variant factory of that game.
// The registry pairs each id with its factory in one place, and the root gives that id
// to `GameFactory` with that factory (issue #234).
// Until #172, `StartGame` takes its factory in its constructor. So the root builds one
// `StartGame` for each registered game, with one `ApplyMove` and one `UndoMove`
// over one `InMemoryGameRepository`, and wraps each use case in the logging aspect.
// It builds the use cases of a game the first time a caller asks for them.
// The publisher goes to `ApplyMove`, which delivers the events of each turn (#233).
export class CompositionRoot {
  private readonly games: GameRegistry;
  private readonly logger: Logger;
  private readonly ids: MatchIdGenerator;
  private readonly events: GameEventPublisher;
  private readonly wired = new Map<RegisteredGame, GameUseCases>();

  constructor(drivers: RootDrivers = { clock: new SystemClock(), logger: new ConsoleLogger() }) {
    const random = SeededRandomSource.fromClock(drivers.clock);
    this.games = new GameRegistry(registeredGames(drivers.clock, random));
    this.logger = drivers.logger;
    this.ids = new SequentialMatchIds(drivers.clock);
    this.events = new NullGameEventPublisher();
  }

  // The game registry. The game selector reads the registered games from it (#169).
  registry(): GameRegistry {
    return this.games;
  }

  // The game use cases of the game `gameId`. Each call for one game gives the same use cases,
  // so the screens of one game share its running game.
  // An id that the registry does not hold throws a RangeError.
  gameUseCases(gameId: GameId): GameUseCases {
    const game = this.games.gameOf(gameId);
    const known = this.wired.get(game);
    if (known !== undefined) return known;
    const built = game.withFactory({
      use: (id, variant) => wire(id, variant, this.ids, this.logger, this.events),
    });
    this.wired.set(game, built);
    return built;
  }
}

// The game use cases of the game `gameId` over one new repository, each inside the logging aspect.
// Every game shares the id generator, the logger and the publisher,
// so each one exists once in the app.
function wire<TState extends BoardState<unknown, unknown> & Cloneable<TState>>(
  gameId: GameId,
  variant: IVariantFactory<unknown, unknown, unknown, TState, unknown>,
  ids: MatchIdGenerator,
  logger: Logger,
  events: GameEventPublisher,
): GameUseCases<unknown, unknown, unknown, ViewOf<TState>> {
  const games = new InMemoryGameRepository<unknown, unknown, unknown, TState>();
  return {
    startGame: new LoggingAspect(
      new StartGame(new GameFactory(gameId, variant, ids), games),
      logger,
      'StartGame',
    ),
    applyMove: new LoggingAspect(new ApplyMove(games, logger, events), logger, 'ApplyMove'),
    undoMove: new LoggingAspect(new UndoMove(games), logger, 'UndoMove'),
  };
}
