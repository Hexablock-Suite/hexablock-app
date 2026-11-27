/** @jest-environment node */
import { AccountPresenter } from '../../src/adapters/account-presenter';
import { AchievementsPresenter } from '../../src/adapters/achievements-presenter';
import type { AccountApi } from '../../src/adapters/api/account-api';
import type { LeaderboardApi } from '../../src/adapters/api/leaderboard-api';
import type { ProgressApi } from '../../src/adapters/api/progress-api';
import { SessionManager } from '../../src/adapters/session-manager';
import { GamePresenter } from '../../src/adapters/game-presenter';
import { HomePresenter } from '../../src/adapters/home-presenter';
import { LeaderboardPresenter } from '../../src/adapters/leaderboard-presenter';
import { LevelSelectorPresenter } from '../../src/adapters/level-selector-presenter';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import { Session } from '../../src/application/session';
import { LevelId } from '../../src/domain/progress/level-id';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { GameId } from '../../src/domain/shared/game-id';
import { Score } from '../../src/domain/shared/score';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { LinesCellRenderer } from '../../src/infrastructure/board/lines-cell-renderer';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { LinesControls } from '../../src/infrastructure/ui/lines-controls';
import type { ScreenServices } from '../../src/infrastructure/ui/screen-services';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { InMemorySecretStore } from '../support/adapters/in-memory-secret-store';
import { RecordingLogger } from '../support/application/recording-logger';
import { ManualClock } from '../support/engine/manual-clock';
import { saveIn } from '../support/adapters/saved-progress';

// Issue #411: the composition root builds the presenter of each screen and answers the questions
// of the hooks through the closed interface `ScreenServices`. A hook keeps only React state.
// Each call builds a new presenter, so a presenter lives as long as the screen that keeps it.

const LINES = GameId.of('hexa-lines');
const FIT = GameId.of('hexa-fit');
const ADA = '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

// The boards of a backend that holds no result.
const NO_BOARDS: LeaderboardApi = {
  globalLeaderboard: (_token, gameId) => Promise.resolve({ gameId, highScores: [], standings: [] }),
  levelLeaderboard: (_token, gameId, levelId) => Promise.resolve({ gameId, levelId, entries: [] }),
};

// A root over an in-memory store. The hooks see it only as `ScreenServices`.
function servicesOver(store = new InMemoryKeyValueStore()): ScreenServices {
  return new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger(), store });
}

describe('CompositionRoot screens', () => {
  it('should_build_a_new_presenter_over_the_use_cases_of_the_root_when_each_screen_asks_for_one', async () => {
    const store = new InMemoryKeyValueStore();
    const saved = GameProgress.start(LINES);
    saved.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }));
    await saveIn(new LocalProgressRepository(store), saved);
    const services = servicesOver(store);
    const loaded = await services.loadProgress().execute({ gameId: LINES });
    const levels = services.levelSelectorPresenter(FIT, TopologyId.hex);
    const achievements = services.achievementsPresenter();
    const session = services.gameSession(LINES, TopologyId.square);

    await levels.onOpen();
    await achievements.onOpen();
    const home = services.homePresenter(TopologyId.square, [
      [LINES, loaded.ok ? loaded.value : undefined],
    ]);

    expect(home).toBeInstanceOf(HomePresenter);
    expect(home.gameSelector().games[0]).toEqual({
      id: 'hexa-lines',
      name: textCatalog.es['game.hexa-lines.name'],
      place: textCatalog.es['game.hexa-lines.place'],
      highScore: `${textCatalog.es['map.highScore']} 36`,
    });
    expect(levels).toBeInstanceOf(LevelSelectorPresenter);
    expect(levels.viewModel().levels).toHaveLength(15);
    expect(achievements).toBeInstanceOf(AchievementsPresenter);
    expect(achievements.viewModel().sections).toHaveLength(2);
    expect(session.presenter).toBeInstanceOf(GamePresenter);
    expect(session.renderer).toBeInstanceOf(LinesCellRenderer);
    expect(session.controls).toBeInstanceOf(LinesControls);
    expect(session.texts).toBe(textCatalog.es);
    expect(services.levelSelectorPresenter(FIT, TopologyId.hex) === levels).toBe(false);
    expect(services.achievementsPresenter() === achievements).toBe(false);
    expect(services.gameSession(LINES, TopologyId.square).presenter === session.presenter).toBe(
      false,
    );
  });

  it('should_answer_the_games_their_tones_and_their_levels_when_a_hook_asks_for_a_figure', () => {
    const services = servicesOver();

    const games = services.gameIds(TopologyId.triangle);

    expect(games.map((id) => services.hasLevels(TopologyId.triangle, id))).toEqual([
      false,
      true,
      true,
      false,
    ]);
    expect(services.gameTone(TopologyId.triangle, FIT)).toEqual(
      services.gameTone(TopologyId.hex, FIT),
    );
    expect(services.figureShape(TopologyId.square, 60).corners).toHaveLength(4);
  });

  // The presenters of the saved progress need the local store, as their use cases do.
  it('should_throw_a_range_error_when_a_root_with_no_store_is_asked_for_a_presenter_of_saved_progress', () => {
    const services: ScreenServices = new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
    });

    expect(() => services.achievementsPresenter()).toThrow(
      'The root has no local store, so it lists no achievements.',
    );
    expect(() => services.levelSelectorPresenter(FIT, TopologyId.hex)).toThrow(
      'The root has no local store, so it lists no levels.',
    );
  });

  // #45: the account screen signs the player in through `Login` of the root, with its aspects,
  // over the transport of the backend and the secure storage of the drivers.
  it('should_build_an_account_presenter_that_keeps_the_session_when_the_root_has_a_backend_and_a_secure_store', async () => {
    const secrets = new InMemorySecretStore();
    const logger = new RecordingLogger();
    const api: AccountApi & ProgressApi & LeaderboardApi = {
      ...NO_BOARDS,
      signUp: () => Promise.resolve(),
      signIn: () => Promise.resolve({ accessToken: 'token-of-ada' }),
      currentUser: () => Promise.resolve({ userId: '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b' }),
      syncProgress: (_token, body) =>
        Promise.resolve({ gameId: body.gameId, highScore: null, updatedAt: '', results: [] }),
    };
    const services: ScreenServices = new CompositionRoot({
      clock: new ManualClock(),
      logger,
      api,
      secrets,
    });
    const account = services.accountPresenter();

    await account.onLogin({ username: 'ada', password: 'correct horse battery' });
    await services
      .accountPresenter()
      .onRegister({ username: 'ada', password: 'correct horse battery' });

    expect(account).toBeInstanceOf(AccountPresenter);
    expect(account.viewModel().signedIn).toBe(`${textCatalog.es['account.signed-in']} ada`);
    expect(services.accountPresenter() === account).toBe(false);
    expect((await new SessionManager(secrets).read())?.token).toBe('token-of-ada');
    expect(logger.entries.map(({ useCase, outcome }) => `${useCase} ${outcome}`)).toEqual([
      'Login success',
      'Register success',
    ]);
  });

  // #47 (APP-FR-14): the leaderboard screen reads each board through its use case of the root,
  // with its aspects, over the transport of the backend and the session of the secure storage.
  it('should_build_a_leaderboard_presenter_that_reads_each_board_with_the_token_of_the_session_when_the_root_has_a_backend_and_a_secure_store', async () => {
    const secrets = new InMemorySecretStore();
    await new SessionManager(secrets).write(new Session('token-of-ada', ADA));
    const logger = new RecordingLogger();
    const calls: string[] = [];
    const row = { rank: 1, userId: ADA, username: 'ada' };
    const api: AccountApi & ProgressApi & LeaderboardApi = {
      signUp: () => Promise.resolve(),
      signIn: () => Promise.resolve({ accessToken: 'token-of-ada' }),
      currentUser: () => Promise.resolve({ userId: ADA }),
      syncProgress: (_token, body) =>
        Promise.resolve({ gameId: body.gameId, highScore: null, updatedAt: '', results: [] }),
      globalLeaderboard: (token, gameId) => {
        calls.push(`global ${token} ${gameId}`);
        return Promise.resolve({
          gameId,
          highScores: [{ ...row, highScore: 2048 }],
          standings: [],
        });
      },
      levelLeaderboard: (token, gameId, levelId) => {
        calls.push(`level ${token} ${gameId} ${levelId}`);
        return Promise.resolve({
          gameId,
          levelId,
          entries: [{ ...row, stars: 3, moves: 12, elapsedMs: 45000 }],
        });
      },
    };
    const services: ScreenServices = new CompositionRoot({
      clock: new ManualClock(),
      logger,
      api,
      secrets,
    });
    const global = services.leaderboardPresenter(LINES);
    const level = services.leaderboardPresenter(FIT, LevelId.of('fit-01'));

    await global.onOpen();
    await level.onOpen();

    expect(global).toBeInstanceOf(LeaderboardPresenter);
    expect(services.leaderboardPresenter(LINES) === global).toBe(false);
    expect(global.viewModel().rows).toEqual([
      { id: 'ada', rank: '1', name: 'ada', value: '2048 puntos' },
    ]);
    expect(level.viewModel().rows).toEqual([
      { id: 'ada', rank: '1', name: 'ada', value: '3 estrellas · 12 movimientos · 0:45' },
    ]);
    expect(calls).toEqual(['global token-of-ada hexa-lines', 'level token-of-ada hexa-fit fit-01']);
    expect(logger.entries.map(({ useCase, outcome }) => `${useCase} ${outcome}`)).toEqual([
      'GetGlobalLeaderboard success',
      'GetLevelLeaderboard success',
    ]);
  });

  it('should_throw_a_range_error_when_a_root_with_no_backend_or_no_secure_store_is_asked_for_a_leaderboard_presenter', () => {
    const noBackend: ScreenServices = new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
      secrets: new InMemorySecretStore(),
    });
    const noSecrets: ScreenServices = new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
      api: { ...NO_BOARDS } as AccountApi & ProgressApi & LeaderboardApi,
    });
    const reason = new RangeError(
      'The root has no backend or no secure store, so it shows no leaderboard.',
    );

    expect(() => noBackend.leaderboardPresenter(LINES)).toThrow(reason);
    expect(() => noSecrets.leaderboardPresenter(FIT, LevelId.of('fit-01'))).toThrow(reason);
  });

  it('should_throw_a_range_error_when_a_root_with_no_backend_or_no_secure_store_is_asked_for_the_account_presenter', () => {
    const services: ScreenServices = new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
      secrets: new InMemorySecretStore(),
    });

    expect(() => services.accountPresenter()).toThrow(
      new RangeError('The root has no backend or no secure store, so it signs no player in.'),
    );
  });
});
