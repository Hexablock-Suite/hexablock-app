import { BundledLevelRepository } from '../adapters/bundled-level-repository';
import { InMemoryGameRepository } from '../adapters/in-memory-game-repository';
import type { KeyValueStore } from '../adapters/key-value-store';
import { LocalProgressRepository } from '../adapters/local-progress-repository';
import { LevelGameFactories } from '../adapters/level-game-factories';
import { NullGameEventPublisher } from '../adapters/null-game-event-publisher';
import { ApplyMove, type ApplyMoveRequest } from '../application/apply-move';
import type { GameEventPublisher } from '../application/game-event-publisher';
import {
  ListAchievements,
  type AchievementSummary,
  type ListAchievementsRequest,
} from '../application/list-achievements';
import type { GameFactories } from '../application/game-factories';
import type { LevelRepository } from '../application/level-repository';
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
import type { GameId } from '../domain/engine/game-id';
import { TopologyId } from '../domain/engine/geometry-factory';
import type { MatchIdGenerator } from '../domain/engine/match-id-generator';
import { ConsoleLogger } from './console-logger';
import { GameRegistry, type RegisteredGame } from './game-registry';
import { registeredAchievements } from './registered-achievements';
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

// The drivers that a test may replace. The app takes the system clock, the console logger
// and `DeviceKeyValueStore`, which `CompositionRootProvider` builds (#188).
// A root with no store reads no saved progress, so it lists no achievements.
export interface RootDrivers {
  readonly clock: Clock;
  readonly logger: Logger;
  readonly store?: KeyValueStore;
}

// The composition root (layers.md, Q9, S3-06 in #151, issue #162). It is the only place
// that imports from every layer. `app/_layout.tsx` only calls it, through
// `CompositionRootProvider`, so `app/` keeps routes only.
// It builds each driver and adapter once and injects it (single scope, classes.md decision 18):
// the clock, the random source, the logger, the one id generator of `MatchId`,
// the event publisher and the level repository of the bundled levels.
// No class has a static `instance()`, so a test passes its own drivers.
// The game registry maps each `GameId` to its game and the variant factory of that game.
// The registry pairs each id with its factory in one place, and the root gives that id
// to `GameFactory` with that factory (issue #234).
// The root builds one registry for each board figure that the player can choose (#171).
// Each variant factory of a registry takes the `GeometryFactory` of its figure, so the choice
// of the figure changes only that argument (APP-FR-16). The hexagon is the default figure.
// The root builds one `StartGame` for each registered game, with one `ApplyMove`, one `UndoMove`
// and one `RedoMove` (#178) over one `InMemoryGameRepository`, and wraps each use case in the
// logging aspect. `StartGame` takes the `GameFactories` port, which `LevelGameFactories`
// implements over the level repository and the level variant of the game. So one `StartGame`
// starts every level of its game by the level id of the request (S3-13 in #151, option D, #172).
// It builds the use cases of a game the first time a caller asks for them.
// The publisher goes to `ApplyMove`, which delivers the events of each turn (#233).
// With the local store of its drivers, the root builds `ListAchievements` once (#188), over
// its one level repository, `LocalProgressRepository` and the achievements
// of `registeredAchievements()`, inside the logging aspect.
export class CompositionRoot {
  private readonly games: ReadonlyMap<TopologyId, GameRegistry>;
  private readonly logger: Logger;
  private readonly ids: MatchIdGenerator;
  private readonly events: GameEventPublisher;
  private readonly levels: LevelRepository;
  private readonly wired = new Map<RegisteredGame, GameUseCases>();
  private readonly achievements: UseCase<ListAchievementsRequest, AchievementSummary[]> | undefined;

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
    this.levels = new BundledLevelRepository();
    this.achievements =
      drivers.store === undefined
        ? undefined
        : new LoggingAspect(
            new ListAchievements(
              this.levels,
              new LocalProgressRepository(drivers.store),
              registeredAchievements(),
            ),
            this.logger,
            'ListAchievements',
          );
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
      use: (id, variant, levels) =>
        wire(
          new LevelGameFactories(id, variant, this.ids, this.levels, levels),
          this.logger,
          this.events,
        ),
    });
    this.wired.set(game, built);
    return built;
  }

  // `ListAchievements` over the saved progress of the device (#188). Each call gives
  // the same use case. A root with no local store throws an Error.
  listAchievements(): UseCase<ListAchievementsRequest, AchievementSummary[]> {
    if (this.achievements === undefined) {
      throw new Error('The root has no local store, so it lists no achievements.');
    }
    return this.achievements;
  }
}

// The game use cases of the game of `factories` over one new repository, each inside
// the logging aspect. Every game shares the id generator, the logger, the publisher
// and the level repository, so each one exists once in the app.
function wire<TState extends BoardState<unknown, unknown> & Cloneable<TState>>(
  factories: GameFactories<unknown, unknown, unknown, TState>,
  logger: Logger,
  events: GameEventPublisher,
): GameUseCases<unknown, unknown, unknown, ViewOf<TState>> {
  const games = new InMemoryGameRepository<unknown, unknown, unknown, TState>();
  return {
    startGame: new LoggingAspect(new StartGame(factories, games), logger, 'StartGame'),
    applyMove: new LoggingAspect(new ApplyMove(games, logger, events), logger, 'ApplyMove'),
    undoMove: new LoggingAspect(new UndoMove(games), logger, 'UndoMove'),
    redoMove: new LoggingAspect(new RedoMove(games), logger, 'RedoMove'),
  };
}
