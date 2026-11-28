/** @jest-environment node */
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import { SessionManager } from '../../src/adapters/session-manager';
import type { LevelSummary } from '../../src/application/levels/level-summary';
import type { MoveResult } from '../../src/application/game/move-result';
import { Session } from '../../src/application/ports/session';
import type { GeometryFactory } from '../../src/domain/engine/geometry/geometry-factory';
import { Turns } from '../../src/domain/engine/geometry/turns';
import { LevelId } from '../../src/domain/progress/level-id';
import { Stars } from '../../src/domain/progress/stars';
import { GameId } from '../../src/domain/shared/game-id';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { PlaceFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';
import { createApiClient } from '../../src/infrastructure/api/client';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { InMemorySecretStore } from '../support/adapters/in-memory-secret-store';
import { valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { withGeometryOf } from '../support/engine/geometry-of';
import { ManualClock } from '../support/engine/manual-clock';
import type { FakeRequest, FakeRoute, FakeRoutes } from '../support/fake-backend';
import { fakeFetch, useFakeFetch, type FakeFetch } from '../support/fake-fetch';

// The Done-when line of #46 (APP-FR-13): «Progress saved in the app appears in the backend entry
// for that user and gameId». The tests run the composition root with the real HTTP client, the
// real gateways, the real session manager and the real local repository. A fake fetch answers as
// hexablock-api does: it keeps one progress entry per user and game, and it keeps the best result
// of each level (DS-12). The pact of test/contract/ checks the same request against hexablock-api.

const BACKEND = 'http://backend.test';
const FIT = GameId.of('hexa-fit');
const ADA = { username: 'ada', password: 'correct horse battery' };
const GRACE = { username: 'grace', password: 'correct horse battery' };
const USERS: Readonly<Record<string, string>> = {
  ada: '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  grace: '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
};

interface Result {
  readonly levelId: string;
  readonly stars: number;
  readonly moves: number;
  readonly elapsedMs: number;
}

// A backend with accounts, tokens and one progress entry per user and game.
// `expired` names the tokens that the backend refuses from now on.
class ProgressBackend {
  readonly entries = new Map<string, Map<string, Result>>();
  readonly expired = new Set<string>();

  routes(): FakeRoutes {
    return {
      '/v1/auth/login': (request) => {
        const { username } = JSON.parse(request.body) as { username: string };
        return { status: 200, body: { accessToken: `token-of-${username}` } };
      },
      '/v1/auth/me': (request) => {
        const user = this.userOf(request);
        return user === undefined
          ? { status: 401, body: { statusCode: 401 } }
          : { status: 200, body: { userId: user } };
      },
      '/v1/progress': (request) => this.sync(request),
    };
  }

  // The results of the entry of `user` and `gameId`, in the order of their level ids.
  resultsOf(user: string, gameId: string): Result[] {
    const entry = this.entries.get(`${user}|${gameId}`);
    return [...(entry?.values() ?? [])].sort((a, b) => a.levelId.localeCompare(b.levelId));
  }

  private userOf(request: FakeRequest): string | undefined {
    const token = String(request.headers.authorization ?? '').replace(/^Bearer /, '');
    if (this.expired.has(token)) return undefined;
    return USERS[token.replace(/^token-of-/, '')];
  }

  private sync(request: FakeRequest): FakeRoute {
    const user = this.userOf(request);
    if (user === undefined) return { status: 401, body: { statusCode: 401 } };
    const body = JSON.parse(request.body) as { gameId: string; results?: Result[] };
    const key = `${user}|${body.gameId}`;
    const entry = this.entries.get(key) ?? new Map<string, Result>();
    for (const result of body.results ?? []) {
      const stored = entry.get(result.levelId);
      if (stored === undefined || better(result, stored)) entry.set(result.levelId, result);
    }
    this.entries.set(key, entry);
    return {
      status: 200,
      body: {
        gameId: body.gameId,
        highScore: null,
        updatedAt: '2026-11-27T10:00:00.000Z',
        results: [...entry.values()],
      },
    };
  }
}

// DS-12: more stars win, then fewer moves, then less time. A full tie keeps the stored result.
function better(left: Result, right: Result): boolean {
  if (left.stars !== right.stars) return left.stars > right.stars;
  if (left.moves !== right.moves) return left.moves < right.moves;
  return left.elapsedMs < right.elapsedMs;
}

// Wins `fit-01` through the use cases of `root` and gives the last response to the result
// presenter of a new session of the root, as the game screen does. The witness takes 3 moves.
async function winFit01(root: CompositionRoot): Promise<void> {
  await withGeometryOf(fit01.topology, {
    use: async <TCoord>(geometry: GeometryFactory<TCoord>) => {
      const { startGame, applyMove } = root.gameUseCases(FIT, TopologyId.hex);
      valueOf(await startGame.execute({ levelId: LevelId.of(fit01.levelId) }));
      let last: MoveResult<unknown, unknown> | undefined;
      for (const entry of fit01.section.witness) {
        const move = new PlaceFitPiece(
          PieceId.of(entry.piece),
          Turns.of(entry.rotation),
          geometry.createCoord(entry.at),
        );
        last = valueOf(await applyMove.execute({ move }));
      }
      if (last === undefined) throw new RangeError('The witness holds no move.');
      await root.gameSession(FIT, TopologyId.hex).result.onFinish(last);
    },
  });
}

// The stars of the level `levelId` in the list of the levels of Hexa Fit on the hexagon of `root`,
// or `undefined` when the progress keeps no result of the level.
async function starsOf(root: CompositionRoot, levelId: string): Promise<number | undefined> {
  const levels: LevelSummary[] = valueOf(
    await root.listLevels().execute({ gameId: FIT, figure: TopologyId.hex }),
  ).levels;
  const stars = levels.find((summary) => summary.levelId.equals(LevelId.of(levelId)))?.stars;
  return stars === undefined
    ? undefined
    : [0, 1, 2, 3].find((count) => stars.equals(Stars.of(count)));
}

describe('progress sync through the root', () => {
  let backend: ProgressBackend;
  let fake: FakeFetch;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    backend = new ProgressBackend();
    fake = fakeFetch(backend.routes());
    spy = useFakeFetch(fake);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  const rootOver = (store: InMemoryKeyValueStore, secrets: InMemorySecretStore) =>
    new CompositionRoot({
      clock: new ManualClock(),
      logger: new RecordingLogger(),
      store,
      api: createApiClient(BACKEND),
      secrets,
    });
  const progressCalls = () => fake.requests.filter(({ url }) => url === '/v1/progress');

  it('should_put_the_saved_result_in_the_backend_entry_of_the_user_and_the_game_when_a_signed_in_player_wins_a_level', async () => {
    const root = rootOver(new InMemoryKeyValueStore(), new InMemorySecretStore());
    await root.accountPresenter().onLogin(ADA);

    await winFit01(root);

    expect(backend.resultsOf(USERS.ada!, 'hexa-fit')).toEqual([
      { levelId: 'fit-01', stars: 3, moves: 3, elapsedMs: 0 },
    ]);
    expect(progressCalls().at(-1)?.headers.authorization).toBe('Bearer token-of-ada');
    expect(backend.resultsOf(USERS.grace!, 'hexa-fit')).toEqual([]);
  });

  // D27: the progress played with no account merges into the first account that signs in.
  it('should_upload_the_progress_played_with_no_account_when_the_player_signs_in', async () => {
    const store = new InMemoryKeyValueStore();
    const root = rootOver(store, new InMemorySecretStore());
    await winFit01(root);
    expect(progressCalls()).toHaveLength(0);

    await root.accountPresenter().onLogin(ADA);

    expect(backend.resultsOf(USERS.ada!, 'hexa-fit')).toEqual([
      { levelId: 'fit-01', stars: 3, moves: 3, elapsedMs: 0 },
    ]);
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
    const own = valueOf(await root.loadProgress().execute({ gameId: FIT }));
    expect(own?.starsOf(LevelId.of('fit-01'))?.equals(Stars.of(3))).toBe(true);
  });

  // A failed sync never loses local progress. `SessionAspect` clears the session on a refused token.
  it('should_keep_the_saved_result_and_clear_the_session_when_the_backend_refuses_the_token', async () => {
    const store = new InMemoryKeyValueStore();
    const secrets = new InMemorySecretStore();
    const root = rootOver(store, secrets);
    await root.accountPresenter().onLogin(ADA);
    backend.expired.add('token-of-ada');

    await winFit01(root);

    await expect(new SessionManager(secrets).read()).resolves.toBeUndefined();
    await expect(store.get(`progress:${USERS.ada}:hexa-fit`)).resolves.toContain('fit-01');
    expect(backend.resultsOf(USERS.ada!, 'hexa-fit')).toEqual([]);
  });

  it('should_ask_the_player_to_sign_in_on_the_result_screen_when_the_backend_refuses_the_token', async () => {
    const secrets = new InMemorySecretStore();
    await new SessionManager(secrets).write(new Session('token-of-ada', USERS.ada!));
    backend.expired.add('token-of-ada');
    const root = rootOver(new InMemoryKeyValueStore(), secrets);
    const { startGame, applyMove } = root.gameUseCases(FIT, TopologyId.hex);
    let last: MoveResult<unknown, unknown> | undefined;
    await withGeometryOf(fit01.topology, {
      use: async <TCoord>(geometry: GeometryFactory<TCoord>) => {
        valueOf(await startGame.execute({ levelId: LevelId.of(fit01.levelId) }));
        for (const entry of fit01.section.witness) {
          last = valueOf(
            await applyMove.execute({
              move: new PlaceFitPiece(
                PieceId.of(entry.piece),
                Turns.of(entry.rotation),
                geometry.createCoord(entry.at),
              ),
            }),
          );
        }
      },
    });
    const session = root.gameSession(FIT, TopologyId.hex);

    await session.result.onFinish(last!);

    expect(session.result.viewModel()?.signIn?.label).toBe('Iniciar sesión');
    expect(session.result.viewModel()?.error).toBeUndefined();
  });

  // Judgment-day round 1, F3: the progress belongs to the last signed-in user. A 401 clears the
  // token only, so the levels that the player won stay open.
  it('should_keep_the_won_levels_when_the_backend_refuses_the_token', async () => {
    const store = new InMemoryKeyValueStore();
    const root = rootOver(store, new InMemorySecretStore());
    await root.accountPresenter().onLogin(ADA);
    backend.expired.add('token-of-ada');

    await winFit01(root);

    expect(await starsOf(root, 'fit-01')).toBe(3);
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
  });

  // F3: a device that kept a session before #46 keeps its progress under the anonymous key.
  // At start the app merges it into the key of the user, so the player sees the won levels.
  it('should_show_the_won_levels_when_the_app_starts_on_a_device_that_kept_a_session_of_version_1', async () => {
    const store = new InMemoryKeyValueStore();
    const secrets = new InMemorySecretStore();
    await secrets.set(
      'session',
      JSON.stringify({ version: 1, token: 'token-of-ada', userId: USERS.ada }),
    );
    await store.set(
      'progress:hexa-fit',
      '{"version":1,"levels":[{"score":0,"levelId":"fit-01","stars":3,"moves":3}]}',
    );

    const root = rootOver(store, secrets);

    expect(await starsOf(root, 'fit-01')).toBe(3);
    await expect(store.get(`progress:${USERS.ada}:hexa-fit`)).resolves.toContain('fit-01');
    await expect(store.get('progress:hexa-fit')).resolves.toBeUndefined();
  });

  // F3: another user who signs in on the device becomes the owner and sees only its own progress.
  it('should_show_only_its_own_progress_when_another_player_signs_in', async () => {
    const root = rootOver(new InMemoryKeyValueStore(), new InMemorySecretStore());
    await root.accountPresenter().onLogin(ADA);
    await winFit01(root);

    await root.accountPresenter().onLogin(GRACE);

    expect(await starsOf(root, 'fit-01')).toBeUndefined();
    expect(valueOf(await root.loadProgress().execute({ gameId: FIT }))).toBeUndefined();
  });
});
