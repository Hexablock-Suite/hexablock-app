import { InMemoryGameRepository } from '../adapters/in-memory-game-repository';
import { NullGameEventPublisher } from '../adapters/null-game-event-publisher';
import { ApplyMove, type ApplyMoveRequest } from '../application/apply-move';
import type { GameEventPublisher } from '../application/game-event-publisher';
import type { Logger } from '../application/logger';
import { LoggingAspect } from '../application/logging-aspect';
import type { MoveResult, ViewOf } from '../application/move-result';
import { RedoMove, type RedoMoveRequest } from '../application/redo-move';
import { StartGame, type StartGameRequest } from '../application/start-game';
import { UndoMove, type UndoMoveRequest } from '../application/undo-move';
import type { UseCase } from '../application/use-case';
import type { BoardState } from '../domain/engine/board-state';
import type { Clock } from '../domain/engine/clock';
import type { Cloneable } from '../domain/engine/cloneable';
import { GameFactory } from '../domain/engine/game-factory';
import type { GameId } from '../domain/engine/game-id';
import { TopologyId } from '../domain/engine/geometry-factory';
import type { MatchIdGenerator } from '../domain/engine/match-id-generator';
import type { IVariantFactory } from '../domain/engine/variant-factory';
import { ConsoleLogger } from './console-logger';
import { GameRegistry, type RegisteredGame } from './game-registry';
import { boardFigures, registeredGames } from './registered-games';
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
  readonly redoMove: UseCase<RedoMoveRequest, MoveResult<TCell, TCoord, TView>>;
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
// The root builds one registry for each board figure that the player can choose (#171).
// Each variant factory of a registry takes the `GeometryFactory` of its figure, so the choice
// of the figure changes only that argument (APP-FR-16). The hexagon is the default figure.
// Until #172, `StartGame` takes its factory in its constructor. So the root builds one
// `StartGame` for each registered game, with one `ApplyMove`, one `UndoMove` and one `RedoMove`
// (#178) over one `InMemoryGameRepository`, and wraps each use case in the logging aspect.
// It builds the use cases of a game the first time a caller asks for them.
// The publisher goes to `ApplyMove`, which delivers the events of each turn (#233).
export class CompositionRoot {
  private readonly games: ReadonlyMap<TopologyId, GameRegistry>;
  private readonly logger: Logger;
  private readonly ids: MatchIdGenerator;
  private readonly events: GameEventPublisher;
  private readonly wired = new Map<RegisteredGame, GameUseCases>();

  constructor(drivers: RootDrivers = { clock: new SystemClock(), logger: new ConsoleLogger() }) {
    const random = SeededRandomSource.fromClock(drivers.clock);
    this.games = new Map(
      boardFigures().map((figure) => [
        figure.id,
        new GameRegistry(registeredGames(figure, drivers.clock, random)),
      ]),
    );
    this.logger = drivers.logger;
    this.ids = new SequentialMatchIds(drivers.clock);
    this.events = new NullGameEventPublisher();
  }

  // The board figures that the player can choose, in the order of the figure selector (#171).
  figures(): TopologyId[] {
    return [...this.games.keys()];
  }

  // The game registry of the board figure `figure`, by default the hexagon.
  // The game selector reads the registered games from it (#169).
  // A figure that the root does not offer throws a RangeError.
  registry(figure: TopologyId = TopologyId.hex): GameRegistry {
    const games = this.games.get(figure);
    if (games === undefined) throw new RangeError('The root offers no board figure with this id.');
    return games;
  }

  // The game use cases of the game `gameId` on the board figure `figure`, by default the hexagon.
  // Each call for one game on one figure gives the same use cases, so the screens of that game
  // share its running game. The game on another figure has its own use cases.
  // An id that the registry of the figure does not hold throws a RangeError.
  gameUseCases(gameId: GameId, figure: TopologyId = TopologyId.hex): GameUseCases {
    const game = this.registry(figure).gameOf(gameId);
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
    redoMove: new LoggingAspect(new RedoMove(games), logger, 'RedoMove'),
  };
}
