import { AchievementCounterListener } from '../adapters/achievement-counter-listener';
import { AchievementsPresenter } from '../adapters/achievements-presenter';
import { BundledLevelRepository } from '../adapters/bundled-level-repository';
import { GameEventBus } from '../adapters/game-event-bus';
import { GamePresenter } from '../adapters/game-presenter';
import { HomePresenter, type SavedProgresses } from '../adapters/home-presenter';
import { InMemoryGameRepository } from '../adapters/in-memory-game-repository';
import type { KeyValueStore } from '../adapters/key-value-store';
import { LocalAchievementCounterRepository } from '../adapters/local-achievement-counter-repository';
import { LocalProgressRepository } from '../adapters/local-progress-repository';
import { LevelGameFactories } from '../adapters/level-game-factories';
import { LevelSelectorPresenter } from '../adapters/level-selector-presenter';
import { DEFAULT_LANGUAGE, textCatalog, type Texts } from '../adapters/texts/text-catalog';
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
import type { LevelSummary } from '../application/level-summary';
import { ListLevels, type ListLevelsRequest } from '../application/list-levels';
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
import type { GameId } from '../domain/shared/game-id';
import type { GameProgress } from '../domain/progress/game-progress';
import { TopologyId } from '../domain/shared/topology-id';
import type { MatchIdGenerator } from '../domain/engine/match-id-generator';
import type { CellShape } from '../adapters/board/board-layout';
import { ConsoleLogger } from './console-logger';
import { GameRegistry, type RegisteredGame } from './game-registry';
import { registeredAchievements } from './registered-achievements';
import { boardFigures, originShape, registeredGames, type BoardFigure } from './registered-games';
import { SeededRandomSource } from './seeded-random-source';
import { SequentialMatchIds } from './sequential-match-ids';
import { SystemClock } from './system-clock';
import type { GameSession, ScreenServices } from './ui/screen-services';
import type { WorldTone } from './ui/theme';

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
// the event bus and the level repository of the bundled levels.
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
// Each `StartGame` also takes the one level repository, the progress repository, the id of its
// game and its figure, and it refuses a locked level (#397). A root with no store gives it
// no progress repository, so only the first level of each figure starts.
// It builds the use cases of a game the first time a caller asks for them.
// The one `GameEventBus` goes to every `ApplyMove`, which delivers the events of each turn (#233).
// The root subscribes the listeners to it once: today `AchievementCounterListener` (#362).
// With the local store of its drivers, the root builds one `LocalAchievementCounterRepository`
// and gives it to that listener, which saves the counters of the achievements (#363).
// The listener also takes the logger of the drivers, so a failed save of the counters reaches the
// log (#384).
// A root with no store has no place for the counters, so it subscribes no counter listener.
// Every use case of the root goes through `decorate()`, which gives it its aspects (#323).
// With the local store of its drivers, the root builds one `LocalProgressRepository` and keeps it
// for every consumer of the saved progress (#323). Over it, the root builds `ListAchievements` once
// (#188), with its one level repository, the one counter repository of the listener (#364)
// and the achievements of `registeredAchievements()`. Over the same repository it builds
// `LoadProgress` once (#181, #410): its request names the game, so it reads every game.
// Over the same two repositories, it builds `ListLevels` once for the level selector
// (#173). The store is optional: a root with no store offers none of the three, and asking for
// one throws a `RangeError`, as for a board figure that the root does not offer.
// The root implements `ScreenServices`, the closed interface of the screens (#411). It builds
// the presenter of each screen over its use cases: `HomePresenter`, `AchievementsPresenter`,
// `LevelSelectorPresenter` and the `GamePresenter` of a game session. Each call builds a new
// presenter, and the hook of a screen keeps it for the life of that screen. The React context
// holds the root as `ScreenServices`, so a hook asks for no other piece of the root.
// The screens show the default language until the player can choose one (#163).
export class CompositionRoot implements ScreenServices {
  private readonly games: ReadonlyMap<TopologyId, GameRegistry>;
  private readonly boards: ReadonlyMap<TopologyId, BoardFigure<unknown>>;
  private readonly logger: Logger;
  private readonly ids: MatchIdGenerator;
  private readonly events: GameEventPublisher;
  private readonly levels: LevelRepository;
  private readonly progress: ProgressRepository | undefined;
  private readonly wired = new Map<RegisteredGame, GameUseCases>();
  private readonly achievements: UseCase<ListAchievementsRequest, AchievementSummary[]> | undefined;
  private readonly levelList: UseCase<ListLevelsRequest, LevelSummary[]> | undefined;
  private readonly texts: Texts = textCatalog[DEFAULT_LANGUAGE];
  private readonly progressLoad: UseCase<LoadProgressRequest, GameProgress | undefined> | undefined;

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
    const events = new GameEventBus();
    const counters =
      drivers.store === undefined
        ? undefined
        : new LocalAchievementCounterRepository(drivers.store);
    if (counters !== undefined) {
      events.subscribe(new AchievementCounterListener(counters, drivers.logger));
    }
    this.events = events;
    this.levels = new BundledLevelRepository();
    this.progress =
      drivers.store === undefined ? undefined : new LocalProgressRepository(drivers.store);
    this.achievements =
      this.progress === undefined || counters === undefined
        ? undefined
        : this.decorate(
            new ListAchievements(this.levels, this.progress, counters, registeredAchievements()),
            'ListAchievements',
          );
    this.levelList =
      this.progress === undefined
        ? undefined
        : this.decorate(new ListLevels(this.levels, this.progress), 'ListLevels');
    this.progressLoad =
      this.progress === undefined
        ? undefined
        : this.decorate(new LoadProgress(this.progress), 'LoadProgress');
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
          { levels: this.levels, progress: this.progress, gameId: id, figure },
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

  // `ListLevels` over the levels of the root and the saved progress of the device (#173).
  // The level selector lists the levels of one game on one figure with it. Each call gives
  // the same use case. A root with no local store does not offer it, so it throws a RangeError,
  // as for a board figure that it does not offer.
  listLevels(): UseCase<ListLevelsRequest, LevelSummary[]> {
    if (this.levelList === undefined) {
      throw new RangeError('The root has no local store, so it lists no levels.');
    }
    return this.levelList;
  }

  // `LoadProgress` over the saved progress of the device (S3-16 in #151, #181). Its request
  // names the game (#410), so each call gives the same use case for every game. A root with
  // no local store does not offer it, so it throws a RangeError, as for a board figure that
  // it does not offer.
  loadProgress(): UseCase<LoadProgressRequest, GameProgress | undefined> {
    if (this.progressLoad === undefined) {
      throw new RangeError('The root has no local store, so it loads no progress.');
    }
    return this.progressLoad;
  }

  // The presenter of the home screen and of the game selector map of the board figure `figure`,
  // by default the hexagon (#169, #411). It holds the ids of the registry of that figure,
  // the board figures of the root and the saved progress `saved` of the games, by default none.
  homePresenter(figure: TopologyId = TopologyId.hex, saved: SavedProgresses = []): HomePresenter {
    return new HomePresenter(this.registry(figure).gameIds(), this.figures(), this.texts, saved);
  }

  // The ids of the registered games of the board figure `figure`, in the order of its registry.
  // A figure that the root does not offer throws a RangeError.
  gameIds(figure: TopologyId): GameId[] {
    return this.registry(figure).gameIds();
  }

  // The world colors of the game `gameId` on the board figure `figure` (#298), from its entry.
  // An id that the registry of the figure does not hold throws a RangeError.
  gameTone(figure: TopologyId, gameId: GameId): WorldTone {
    return this.registry(figure).gameOf(gameId).tone;
  }

  // Whether the game `gameId` has levels on the board figure `figure` (#173), from its entry.
  // An id that the registry of the figure does not hold throws a RangeError.
  hasLevels(figure: TopologyId, gameId: GameId): boolean {
    return this.registry(figure).gameOf(gameId).hasLevels;
  }

  // A new presenter of the achievements screen over `listAchievements()` (#188, #411).
  // A root with no local store throws the RangeError of `listAchievements()`.
  achievementsPresenter(): AchievementsPresenter {
    return new AchievementsPresenter(this.listAchievements(), this.texts);
  }

  // A new presenter of the level selector of the game `gameId` on the board figure `figure`,
  // over `listLevels()` (#173, #411). A root with no local store throws the RangeError
  // of `listLevels()`.
  levelSelectorPresenter(gameId: GameId, figure: TopologyId): LevelSelectorPresenter {
    return new LevelSelectorPresenter(this.listLevels(), { gameId, figure }, this.texts);
  }

  // A new session of the game `gameId` on the board figure `figure`, by default the hexagon
  // (#170, #171, #411). Its `GamePresenter` takes the four game use cases of `gameUseCases()`,
  // so two sessions of one game on one figure share its running game. It also takes the state
  // mapper and the move mapper (#405) of the registry entry. The session also holds the screen
  // parts of the registry entry. An id that the registry of the figure does not hold
  // throws a RangeError.
  gameSession(gameId: GameId, figure: TopologyId = TopologyId.hex): GameSession {
    const { screen } = this.registry(figure).gameOf(gameId);
    const { startGame, applyMove, undoMove, redoMove } = this.gameUseCases(gameId, figure);
    return {
      presenter: new GamePresenter(
        startGame,
        applyMove,
        undoMove,
        redoMove,
        screen.mapper,
        screen.moves,
        this.texts,
      ),
      renderer: screen.renderer,
      controls: screen.controls,
      layoutOf: (size) => screen.layoutOf(size),
      texts: this.texts,
    };
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

// What `StartGame` reads to refuse a locked level (#397): the one level repository and the
// progress repository of the root, the id of the game and the figure.
interface LevelLock {
  readonly levels: LevelRepository;
  readonly progress: ProgressRepository | undefined;
  readonly gameId: GameId;
  readonly figure: TopologyId;
}

// The game use cases of the game of `factories` over one new repository, each through
// `decorate`. Every game shares the id generator, the event bus and the level repository,
// so each one exists once in the app. The logger reaches a use case only through `decorate`.
// `StartGame` also takes `lock`, so it can refuse a locked level (#397).
function wire<TState extends BoardState<unknown, unknown> & Cloneable<TState>>(
  factories: GameFactories<unknown, unknown, unknown, TState>,
  lock: LevelLock,
  events: GameEventPublisher,
  decorate: Decorate,
): GameUseCases<unknown, unknown, unknown, ViewOf<TState>> {
  const games = new InMemoryGameRepository<unknown, unknown, unknown, TState>();
  return {
    startGame: decorate(
      new StartGame(factories, games, lock.levels, lock.progress, lock.gameId, lock.figure),
      'StartGame',
    ),
    applyMove: decorate(new ApplyMove(games, events), 'ApplyMove'),
    undoMove: decorate(new UndoMove(games), 'UndoMove'),
    redoMove: decorate(new RedoMove(games), 'RedoMove'),
  };
}
