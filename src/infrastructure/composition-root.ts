import { BundledLevelRepository } from '../adapters/bundled-level-repository';
import { InMemoryGameRepository } from '../adapters/in-memory-game-repository';
import type { KeyValueStore } from '../adapters/key-value-store';
import { LocalProgressRepository } from '../adapters/local-progress-repository';
import { LevelGameFactories } from '../adapters/level-game-factories';
import { NullGameEventPublisher } from '../adapters/null-game-event-publisher';
import { ApplyMove, type ApplyMoveRequest } from '../application/apply-move';
import type { GameEventPublisher } from '../application/game-event-publisher';
import { LoadProgress, type LoadProgressRequest } from '../application/load-progress';
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
import type { ProgressRepository } from '../application/progress-repository';
import { RedoMove, type RedoMoveRequest } from '../application/redo-move';
import { StartGame, type StartGameRequest } from '../application/start-game';
import { UndoMove, type UndoMoveRequest } from '../application/undo-move';
import type { UseCase } from '../application/use-case';
import { wrapInAspects } from '../application/use-case-aspect';
import type { BoardState } from '../domain/engine/board-state';
import type { Clock } from '../domain/engine/clock';
import type { Cloneable } from '../domain/engine/cloneable';
import type { GameId } from '../domain/engine/game-id';
import type { GameProgress } from '../domain/engine/game-progress';
import { TopologyId } from '../domain/engine/geometry-factory';
import type { MatchIdGenerator } from '../domain/engine/match-id-generator';
import type { CellShape } from './board/board-layout';
import { ConsoleLogger } from './console-logger';
import { GameRegistry, type RegisteredGame } from './game-registry';
import { registeredAchievements } from './registered-achievements';
import { boardFigures, originShape, registeredGames, type BoardFigure } from './registered-games';
import { SeededRandomSource } from './seeded-random-source';
import { SequentialMatchIds } from './sequential-match-ids';
import { SystemClock } from './system-clock';

// The game use cases of one game. Each one is behind the `UseCase` input port (decision 9)
// and inside its aspects, so a presenter never sees a concrete use case.
// `TView` is the variant data of the response (decision 29).
export interface GameUseCases<TCell = unknown, TCoord = unknown, TMove = unknown, TView = unknown> {
  readonly startGame: UseCase<StartGameRequest, MoveResult<TCell, TCoord, TView>>;
  readonly applyMove: UseCase<ApplyMoveRequest<TMove>, MoveResult<TCell, TCoord, TView>>;
  readonly undoMove: UseCase<UndoMoveRequest, MoveResult<TCell, TCoord, TView>>;
  readonly redoMove: UseCase<RedoMoveRequest, MoveResult<TCell, TCoord, TView>>;
}

// The drivers that a test may replace. The app takes the system clock, the console logger
// and `DeviceKeyValueStore`, which `CompositionRootProvider` builds (#188).
// The store stays optional. A root with no store reads no saved progress,
// so it lists no achievements and loads no progress.
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
// and one `RedoMove` (#178) over one `InMemoryGameRepository`. `StartGame` takes
// the `GameFactories` port, which `LevelGameFactories`
// implements over the level repository and the level variant of the game. So one `StartGame`
// starts every level of its game by the level id of the request (S3-13 in #151, option D, #172).
// It builds the use cases of a game the first time a caller asks for them.
// The publisher goes to `ApplyMove`, which delivers the events of each turn (#233).
// Every use case of the root goes through `decorate()`, which gives it its aspects (#323).
// With the local store of its drivers, the root builds one `LocalProgressRepository` and keeps it
// for every consumer of the saved progress (#323). Over it, the root builds `ListAchievements` once
// (#188), with its one level repository and the achievements of `registeredAchievements()`, and it
// offers `loadProgress(gameId)` (#181): one `LoadProgress` per call, which reads the saved progress
// of that game through the one repository. The store is optional: a root with no store offers
// neither, and asking for it throws a `RangeError`, as for a board figure that the root does not offer.
export class CompositionRoot {
  private readonly games: ReadonlyMap<TopologyId, GameRegistry>;
  private readonly boards: ReadonlyMap<TopologyId, BoardFigure<unknown>>;
  private readonly logger: Logger;
  private readonly ids: MatchIdGenerator;
  private readonly events: GameEventPublisher;
  private readonly levels: LevelRepository;
  private readonly progress: ProgressRepository | undefined;
  private readonly wired = new Map<RegisteredGame, GameUseCases>();
  private readonly achievements: UseCase<ListAchievementsRequest, AchievementSummary[]> | undefined;

  constructor(drivers: RootDrivers = { clock: new SystemClock(), logger: new ConsoleLogger() }) {
    const random = SeededRandomSource.fromClock(drivers.clock);
    const figures = boardFigures();
    this.boards = new Map(figures.map((figure) => [figure.id, figure]));
    this.games = new Map(
      figures.map((figure) => [
        figure.id,
        new GameRegistry(registeredGames(figure, drivers.clock, random)),
      ]),
    );
    this.logger = drivers.logger;
    this.ids = new SequentialMatchIds(drivers.clock);
    this.events = new NullGameEventPublisher();
    this.levels = new BundledLevelRepository();
    this.progress =
      drivers.store === undefined ? undefined : new LocalProgressRepository(drivers.store);
    this.achievements =
      this.progress === undefined
        ? undefined
        : this.decorate(
            new ListAchievements(this.levels, this.progress, registeredAchievements()),
            'ListAchievements',
          );
  }

  // The board figures that the player can choose, in the order of the figure selector (#171).
  figures(): TopologyId[] {
    return [...this.games.keys()];
  }

  // The shape of the origin cell of the board figure `figure`, with `size` points on the longer
  // side of its box (#297). The stones of the home screen and of the map and the glyphs of the
  // figure selector take it, so they show the figure as the board does.
  // A figure that the root does not offer throws a RangeError.
  figureShape(figure: TopologyId, size: number): CellShape {
    const board = this.boards.get(figure);
    if (board === undefined) throw new RangeError('The root offers no board figure with this id.');
    return originShape(board, size);
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
          this.events,
          (useCase, name) => this.decorate(useCase, name),
        ),
    });
    this.wired.set(game, built);
    return built;
  }

  // `ListAchievements` over the saved progress of the device (#188). Each call gives
  // the same use case. A root with no local store does not offer it, so it throws a RangeError,
  // as for a board figure that it does not offer.
  listAchievements(): UseCase<ListAchievementsRequest, AchievementSummary[]> {
    if (this.achievements === undefined) {
      throw new RangeError('The root has no local store, so it lists no achievements.');
    }
    return this.achievements;
  }

  // The saved progress of the game `gameId` (S3-16 in #151, #181). The use case is stateless,
  // so each call gives a new one over the one repository, as `decorate()` wraps it. A root with
  // no local store does not offer it, so it throws a RangeError, as for a board figure that
  // it does not offer.
  loadProgress(gameId: GameId): UseCase<LoadProgressRequest, GameProgress | undefined> {
    if (this.progress === undefined) {
      throw new RangeError('The root has no local store, so it loads no progress.');
    }
    return this.decorate(new LoadProgress(this.progress, gameId), 'LoadProgress');
  }

  // The one place that gives a use case of the root its aspects (#323). `name` names the use case
  // in the log. The chain runs from the outside in. Today it holds `LoggingAspect` only.
  // A later aspect enters the chain here, and no other line of the root changes.
  private decorate<TRequest, TResponse>(
    useCase: UseCase<TRequest, TResponse>,
    name: string,
  ): UseCase<TRequest, TResponse> {
    return wrapInAspects(useCase, [(inner) => new LoggingAspect(inner, this.logger, name)]);
  }
}

// Gives a use case of the root its aspects. `name` names the use case in the log.
type Decorate = <TRequest, TResponse>(
  useCase: UseCase<TRequest, TResponse>,
  name: string,
) => UseCase<TRequest, TResponse>;

// The game use cases of the game of `factories` over one new repository, each through
// `decorate`. Every game shares the id generator, the publisher and the level repository,
// so each one exists once in the app. The logger reaches a use case only through `decorate`.
function wire<TState extends BoardState<unknown, unknown> & Cloneable<TState>>(
  factories: GameFactories<unknown, unknown, unknown, TState>,
  events: GameEventPublisher,
  decorate: Decorate,
): GameUseCases<unknown, unknown, unknown, ViewOf<TState>> {
  const games = new InMemoryGameRepository<unknown, unknown, unknown, TState>();
  return {
    startGame: decorate(new StartGame(factories, games), 'StartGame'),
    applyMove: decorate(new ApplyMove(games, events), 'ApplyMove'),
    undoMove: decorate(new UndoMove(games), 'UndoMove'),
    redoMove: decorate(new RedoMove(games), 'RedoMove'),
  };
}
