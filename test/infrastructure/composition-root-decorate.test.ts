/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import fitSquare01 from '../../src/adapters/levels/fit/fit-square-01.json';
import type { AccountApi } from '../../src/adapters/api/account-api';
import { ApiFailure } from '../../src/adapters/api/api-failure';
import type { LeaderboardApi } from '../../src/adapters/api/leaderboard-api';
import type { LevelsApi } from '../../src/adapters/api/levels-api';
import type { ProgressApi } from '../../src/adapters/api/progress-api';
import type { SecretStore } from '../../src/adapters/secret-store';
import { SessionManager } from '../../src/adapters/session-manager';
import { Session } from '../../src/application/ports/session';
import type { Clock } from '../../src/domain/engine/turn/clock';
import { ClockReading } from '../../src/domain/engine/turn/clock-reading';
import { LevelId } from '../../src/domain/progress/level-id';
import { LevelStatus } from '../../src/domain/progress/level-status';
import { GameResult } from '../../src/domain/progress/progress-model';
import { ElapsedTime } from '../../src/domain/shared/elapsed-time';
import { GameId } from '../../src/domain/shared/game-id';
import { Moves } from '../../src/domain/shared/moves';
import { Score } from '../../src/domain/shared/score';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { InMemorySecretStore } from '../support/adapters/in-memory-secret-store';
import { valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { delivered } from '../support/engine/value-receiver';
import { ManualClock } from '../support/engine/manual-clock';
import { repoRoot } from '../support/run-tool';

// Issue #323: the composition root gives every use case its aspects through one `decorate()`,
// and it builds one `LocalProgressRepository` for every consumer of the saved progress.
// Each test enters through the public operations of the root, except the test that reads its source.

const ROOT_SOURCE = path.join(repoRoot, 'src/infrastructure/composition-root.ts');

const LINES = GameId.of('hexa-lines');
const FIT = GameId.of('hexa-fit');
const ADA = '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const CREDENTIALS = { username: 'ada', password: 'correct horse battery' };

// A clock that moves 7 ms forward at each reading.
class SteppingClock implements Clock {
  private ms = 1_000_000;

  now(): ClockReading {
    this.ms += 7;
    return ClockReading.of(this.ms);
  }
}

// The number of matches of `pattern` in `text`.
function countOf(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

// A clock that records each reading in `events`. It does not move.
class RecordingClock implements Clock {
  constructor(private readonly events: string[]) {}

  now(): ClockReading {
    this.events.push('clock read');
    return ClockReading.of(1_000_000);
  }
}

// A secure store in memory that records each read and each write of a key in `events`.
class RecordingSecretStore implements SecretStore {
  private readonly secrets = new InMemorySecretStore();

  constructor(private readonly events: string[]) {}

  get(key: string): Promise<string | undefined> {
    this.events.push(`secret get ${key}`);
    return this.secrets.get(key);
  }

  set(key: string, value: string): Promise<void> {
    this.events.push(`secret set ${key}`);
    return this.secrets.set(key, value);
  }

  remove(key: string): Promise<void> {
    this.events.push(`secret remove ${key}`);
    return this.secrets.remove(key);
  }
}

// A backend that signs Ada in, syncs every progress and answers every board.
// `refuse` makes the global board refuse the token with a 401. Each board call goes to `events`.
function backendOf(events: string[] = [], refuse = false) {
  const api: AccountApi & ProgressApi & LeaderboardApi & LevelsApi = {
    getLevels: () => Promise.resolve({ levels: [] }),
    signUp: () => Promise.resolve(),
    signIn: () => Promise.resolve({ accessToken: 'token-of-ada' }),
    currentUser: () => Promise.resolve({ userId: ADA }),
    syncProgress: (_token, body) =>
      Promise.resolve({ gameId: body.gameId, highScore: null, updatedAt: '', results: [] }),
    globalLeaderboard: (token, gameId) => {
      events.push(`backend global ${token} ${gameId}`);
      return refuse
        ? Promise.reject(new ApiFailure(401, 'The backend refuses the token.'))
        : Promise.resolve({ gameId, highScores: [], standings: [] });
    },
    levelLeaderboard: (token, gameId, levelId) => {
      events.push(`backend level ${token} ${gameId} ${levelId}`);
      return Promise.resolve({ gameId, levelId, entries: [] });
    },
  };
  return api;
}

// The result of a won Fit level `file` with the moves of its witness.
function wonFitLevel(file: typeof fit01): GameResult {
  return GameResult.of({
    gameId: FIT,
    score: Score.of(0),
    moves: Moves.of(file.section.witness.length),
    levelId: LevelId.of(file.levelId),
    elapsedMs: ElapsedTime.ofMs(1_000),
  });
}

// The id and the status of each level of Hexa Fit on `figure` that is completed in `root`.
async function completedFitLevels(root: CompositionRoot, figure: TopologyId): Promise<string[]> {
  const { levels } = valueOf(await root.listLevels().execute({ gameId: FIT, figure }));
  return levels
    .filter(({ status }) => status.equals(LevelStatus.completed))
    .map(({ levelId }) => String(delivered(levelId)));
}

describe('CompositionRoot decorate', () => {
  // Decision 69 of classes.md: each use case of the root has `LoggingAspect` as its outer aspect.
  // So every use case that the root builds leaves its own entry in the log.
  // The root builds `LoggingAspect` only inside `decorate()`, so each name proves one decorated use case.
  it('should_log_every_use_case_of_the_root_under_its_own_name_when_the_root_has_every_driver', async () => {
    const logger = new RecordingLogger();
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger,
      store: new InMemoryKeyValueStore(),
      api: backendOf(),
      secrets: new InMemorySecretStore(),
    });
    const { startGame, applyMove, undoMove, redoMove, saveProgressOf } = root.gameUseCases(FIT);

    await startGame.execute({ levelId: LevelId.of(fit01.levelId) });
    await applyMove.execute({ move: undefined });
    await undoMove.execute({});
    await redoMove.execute({});
    await (await saveProgressOf(LevelId.of(fit01.levelId))).execute(wonFitLevel(fit01));
    await root.listLevels().execute({ gameId: FIT, figure: TopologyId.hex });
    await root.loadProgress().execute({ gameId: FIT });
    await root.listAchievements().execute({});
    await root.accountPresenter().onRegister(CREDENTIALS);
    await root.accountPresenter().onLogin(CREDENTIALS);
    await root.leaderboardPresenter(LINES).onOpen();
    await root.leaderboardPresenter(FIT, LevelId.of(fit01.levelId)).onOpen();

    expect([...new Set(logger.entries.map((entry) => entry.useCase))]).toEqual([
      'StartGame',
      'ApplyMove',
      'UndoMove',
      'RedoMove',
      'SaveProgress',
      'ListLevels',
      'LoadProgress',
      'ListAchievements',
      'Register',
      'SyncProgress',
      'Login',
      'GetGlobalLeaderboard',
      'GetLevelLeaderboard',
    ]);
  });

  // Decision 69 of classes.md: the chain of a leaderboard is `LoggingAspect`, `SessionAspect`, the use case.
  // `LoggingAspect` records through the clock and the log, `SessionAspect` through the secure store.
  // The outer aspect sees the call first and the result last.
  // The backend refuses the token, so `SessionAspect` clears the session before the log entry.
  it('should_let_the_logging_aspect_see_the_call_first_and_the_result_last_when_the_root_chains_it_outside_the_session_aspect', async () => {
    const events: string[] = [];
    const secrets = new RecordingSecretStore(events);
    await new SessionManager(secrets).write(new Session('token-of-ada', ADA));
    const root = new CompositionRoot({
      clock: new RecordingClock(events),
      logger: {
        log: (entry) => events.push(`log ${entry.useCase} ${entry.outcome} ${entry.error?.code}`),
      },
      api: backendOf(events, true),
      secrets,
    });
    const board = root.leaderboardPresenter(LINES);
    events.length = 0;

    await board.onOpen();

    expect(events).toEqual([
      'clock read',
      'secret get session',
      'secret get session',
      'backend global token-of-ada hexa-lines',
      'secret get session',
      'secret set session',
      'clock read',
      'log GetGlobalLeaderboard failure session-expired',
    ]);
  });

  // The root builds one `LocalProgressRepository` and gives it to every consumer of the saved progress.
  // `SaveProgress` of Hexa Fit on two figures writes one progress of the game at the same time.
  // The one repository runs the two writes in one queue, so the progress keeps both results.
  // `ListLevels` and `LoadProgress` read that same progress.
  it('should_let_list_levels_and_load_progress_see_both_results_when_save_progress_of_two_figures_runs_at_once', async () => {
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
      store: new InMemoryKeyValueStore(),
    });
    const hexagon = await root
      .gameUseCases(FIT, TopologyId.hex)
      .saveProgressOf(LevelId.of(fit01.levelId));
    const square = await root
      .gameUseCases(FIT, TopologyId.square)
      .saveProgressOf(LevelId.of(fitSquare01.levelId));

    const saved = await Promise.all([
      hexagon.execute(wonFitLevel(fit01)),
      square.execute(wonFitLevel(fitSquare01)),
    ]);
    const loaded = valueOf(await root.loadProgress().execute({ gameId: FIT }));

    expect(saved.map((result) => result.ok)).toEqual([true, true]);
    expect(await completedFitLevels(root, TopologyId.hex)).toEqual([fit01.levelId]);
    expect(await completedFitLevels(root, TopologyId.square)).toEqual([fitSquare01.levelId]);
    expect(
      [fit01, fitSquare01].map((file) => loaded?.starsOf(LevelId.of(file.levelId)) !== undefined),
    ).toEqual([true, true]);
  });

  it('should_log_each_use_case_under_its_own_name_when_the_root_decorates_it', async () => {
    const logger = new RecordingLogger();
    const root = new CompositionRoot({
      clock: new ManualClock(),
      logger,
      store: new InMemoryKeyValueStore(),
    });
    const { startGame, applyMove, undoMove, redoMove } = root.gameUseCases(GameId.of('hexa-lines'));

    await applyMove.execute({ move: undefined });
    await startGame.execute({});
    await undoMove.execute({});
    await redoMove.execute({});
    await root.listAchievements().execute({});
    await root.loadProgress().execute({ gameId: GameId.of('hexa-lines') });
    await root.listLevels().execute({ gameId: GameId.of('hexa-fit'), figure: TopologyId.hex });

    expect(logger.entries.map((entry) => [entry.useCase, entry.outcome])).toEqual([
      ['ApplyMove', 'failure'],
      ['StartGame', 'success'],
      ['UndoMove', 'failure'],
      ['RedoMove', 'failure'],
      ['ListAchievements', 'success'],
      ['LoadProgress', 'success'],
      ['ListLevels', 'success'],
    ]);
  });

  // The root gives `LoggingAspect` the clock of its drivers (issue #343).
  // `LoadProgress` reads no clock, so the aspect reads it twice: one step of 7 ms.
  it('should_log_the_duration_from_the_clock_of_its_drivers_when_the_root_decorates_a_use_case', async () => {
    const logger = new RecordingLogger();
    const root = new CompositionRoot({
      clock: new SteppingClock(),
      logger,
      store: new InMemoryKeyValueStore(),
    });

    await root.loadProgress().execute({ gameId: GameId.of('hexa-lines') });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].useCase).toBe('LoadProgress');
    expect(logger.entries[0].elapsedMs?.equals(ElapsedTime.ofMs(7))).toBe(true);
  });

  // The progress repository of the root is one object for every consumer of the saved progress.
  it('should_build_the_local_progress_repository_once_when_the_root_source_is_read', () => {
    const source = readFileSync(ROOT_SOURCE, 'utf8');

    expect(countOf(source, /new LocalProgressRepository\(/g)).toBe(1);
  });

  // A root with no local store offers no achievements: the root throws the typed error
  // of an offer that it does not have, as it does for a board figure.
  it('should_throw_a_range_error_when_a_root_with_no_store_is_asked_for_its_achievements', () => {
    const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });

    expect(() => root.listAchievements()).toThrow(RangeError);
    expect(() => root.listAchievements()).toThrow(
      'The root has no local store, so it lists no achievements.',
    );
  });
});
