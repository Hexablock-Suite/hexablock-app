/** @jest-environment node */
import { AccountPresenter } from '../../src/adapters/account-presenter';
import { AchievementsPresenter } from '../../src/adapters/achievements-presenter';
import type { AccountApi } from '../../src/adapters/api/account-api';
import { SessionManager } from '../../src/adapters/session-manager';
import { GamePresenter } from '../../src/adapters/game-presenter';
import { HomePresenter } from '../../src/adapters/home-presenter';
import { LevelSelectorPresenter } from '../../src/adapters/level-selector-presenter';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
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

// Issue #411: the composition root builds the presenter of each screen and answers the questions
// of the hooks through the closed interface `ScreenServices`. A hook keeps only React state.
// Each call builds a new presenter, so a presenter lives as long as the screen that keeps it.

const LINES = GameId.of('hexa-lines');
const FIT = GameId.of('hexa-fit');

// A root over an in-memory store. The hooks see it only as `ScreenServices`.
function servicesOver(store = new InMemoryKeyValueStore()): ScreenServices {
  return new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger(), store });
}

describe('CompositionRoot screens', () => {
  it('should_build_a_new_presenter_over_the_use_cases_of_the_root_when_each_screen_asks_for_one', async () => {
    const store = new InMemoryKeyValueStore();
    const saved = GameProgress.start(LINES);
    saved.recordScore(ProgressRecord.of({ gameId: LINES, score: Score.of(36) }));
    await new LocalProgressRepository(store).save(saved);
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
    const api: AccountApi = {
      signUp: () => Promise.resolve(),
      signIn: () => Promise.resolve({ accessToken: 'token-of-ada' }),
      currentUser: () => Promise.resolve({ userId: '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b' }),
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
