/** @jest-environment node */
import type { LevelsApi } from '../../src/adapters/api/levels-api';
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import fit02 from '../../src/adapters/levels/fit/fit-02.json';
import { LocalProgressRepository } from '../../src/adapters/local-progress-repository';
import { GameProgress } from '../../src/domain/progress/game-progress';
import { LevelId } from '../../src/domain/progress/level-id';
import { ProgressRecord } from '../../src/domain/progress/progress-model';
import { Stars } from '../../src/domain/progress/stars';
import { GameId } from '../../src/domain/shared/game-id';
import { Score } from '../../src/domain/shared/score';
import { TopologyId } from '../../src/domain/shared/topology-id';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import {
  AnsweringLevelsApi,
  backendWithLevels,
  DeferredLevelsApi,
  flushPromises,
  UnreachableLevelsApi,
} from '../support/adapters/levels-api-double';
import { saveIn } from '../support/adapters/saved-progress';
import { RecordingLogger } from '../support/application/recording-logger';
import { delivered } from '../support/engine/value-receiver';
import { ManualClock } from '../support/engine/manual-clock';

// Issues #48 and #307 through the composition root. The root takes the transport of the levels
// in its driver `api`, and the tests give it a transport double in place of HTTP. The root joins
// the bundled levels and the backend levels for every use case of the levels, and it starts one
// request of the levels when it builds the backend repository. No use case waits for that
// request (D27): `flushPromises()` lets the answer of a double arrive before a use case runs.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');

// A root over the store `store` and the transport of the levels `levels`.
function rootOver(levels: LevelsApi, store = new InMemoryKeyValueStore()): CompositionRoot {
  return new CompositionRoot({
    clock: new ManualClock(),
    logger: new RecordingLogger(),
    store,
    api: backendWithLevels(levels),
  });
}

// Saves a won result with one star of each level of `levelIds` of the game `gameId`.
async function saveWon(store: InMemoryKeyValueStore, gameId: GameId, levelIds: readonly LevelId[]) {
  const saved = GameProgress.start(gameId);
  for (const levelId of levelIds) {
    saved.recordLevel(
      ProgressRecord.of({ gameId, score: Score.of(0), levelId, stars: Stars.of(1) }),
    );
  }
  await saveIn(new LocalProgressRepository(store), saved);
}

// Lists the levels of Fit and Sort on every figure through the root, and starts each listed
// level. It gives one line per level: its id and `started` or the code of the failure.
async function startEveryListedLevel(root: CompositionRoot): Promise<string[]> {
  const started: string[] = [];
  for (const gameId of [FIT, SORT]) {
    for (const figure of root.figures()) {
      const listed = await root.listLevels().execute({ gameId, figure });
      for (const { levelId } of listed.ok ? listed.value.levels : []) {
        const start = await root.gameUseCases(gameId, figure).startGame.execute({ levelId });
        started.push(`${delivered(levelId)} ${start.ok ? 'started' : start.error.code}`);
      }
    }
  }
  return started.sort();
}

// The line of each bundled level of Fit and Sort, as `startEveryListedLevel()` gives it when
// every level starts. It also saves a won result of every bundled level in `store`, so no level
// is locked.
async function everyBundledLevelStarted(store: InMemoryKeyValueStore): Promise<string[]> {
  const expected: string[] = [];
  for (const gameId of [FIT, SORT]) {
    const bundled = await new BundledLevelRepository().list(gameId);
    await saveWon(
      store,
      gameId,
      bundled.map((level) => level.levelId()),
    );
    expected.push(...bundled.map((level) => `${delivered(level.levelId())} started`));
  }
  return expected.sort();
}

describe('backend levels in the composition root', () => {
  // The root starts one request of the levels when it builds the backend repository, so the first
  // screen after the answer shows the backend levels.
  it('should_send_one_request_of_the_levels_when_the_root_is_built', () => {
    const api = new DeferredLevelsApi();

    rootOver(api);

    expect(api.calls()).toBe(1);
  });

  // Done when of #48 and the check of APP-FR-15: with the network off, every bundled level opens.
  it('should_list_and_start_every_bundled_level_when_the_backend_does_not_answer', async () => {
    const api = new UnreachableLevelsApi();
    const store = new InMemoryKeyValueStore();
    const root = rootOver(api, store);
    const expected = await everyBundledLevelStarted(store);

    await flushPromises();
    const started = await startEveryListedLevel(root);

    expect(started).toEqual(expected);
    expect(started).toHaveLength(37);
    expect(api.calls()).toBeGreaterThan(0);
  });

  // D27: no screen waits for the network. While the request of the levels hangs, every bundled
  // level still lists and starts.
  it('should_list_and_start_every_bundled_level_when_the_request_of_the_levels_hangs', async () => {
    const api = new DeferredLevelsApi();
    const store = new InMemoryKeyValueStore();
    const root = rootOver(api, store);
    const expected = await everyBundledLevelStarted(store);

    const started = await startEveryListedLevel(root);

    expect(started).toEqual(expected);
    expect(api.calls()).toBe(1);
  });

  // The check of APP-FR-15: with a bundled copy and a backend copy of one level, the copy with
  // the higher `version` loads (DS-11). The backend copy of `fit-01` holds the figure of `fit-02`.
  // With an equal version the bundled copy loads.
  it('should_start_the_backend_copy_of_a_level_only_when_its_version_is_higher', async () => {
    const spacesOfStart = async (version: number) => {
      const copy = { ...fit01, version, section: fit02.section };
      const root = rootOver(new AnsweringLevelsApi([copy]));
      await flushPromises();
      const start = await root
        .gameUseCases(FIT)
        .startGame.execute({ levelId: LevelId.of('fit-01') });
      return start.ok ? start.value.freeSpaces.length + start.value.cells.length : start.error.code;
    };

    expect(fit02.section.figure.length).not.toBe(fit01.section.figure.length);
    expect(await spacesOfStart(2)).toBe(fit02.section.figure.length);
    expect(await spacesOfStart(1)).toBe(fit01.section.figure.length);
  });

  // Issue #307: a level that the backend lists as unavailable shows apart as not available, and
  // the player cannot start it.
  it('should_show_an_unavailable_backend_level_apart_and_refuse_to_start_it_when_the_app_has_no_bundled_copy', async () => {
    const root = rootOver(
      new AnsweringLevelsApi(
        [],
        [{ gameId: 'hexa-fit', levelId: 'fit-16', reason: 'invalid-section' }],
      ),
    );
    await flushPromises();
    const presenter = root.levelSelectorPresenter(FIT, TopologyId.hex);

    await presenter.onOpen();
    const start = await root.gameUseCases(FIT).startGame.execute({ levelId: LevelId.of('fit-16') });

    expect(presenter.viewModel().unavailable).toEqual({
      title: 'Niveles no disponibles',
      levels: [
        {
          id: 'fit-16',
          name: 'fit-16',
          status: 'No disponible',
          completed: false,
          playable: false,
        },
      ],
    });
    expect(presenter.viewModel().levels.map(({ id }) => id)).not.toContain('fit-16');
    expect(start.ok ? 'started' : start.error.code).toBe('start-failed');
  });

  // Issue #307: a bundled copy of a level that the backend lists as unavailable wins. It lists
  // as a level of the game, the section of the unavailable levels does not name it, and it starts.
  it('should_list_and_start_the_bundled_copy_when_the_backend_lists_the_same_level_as_unavailable', async () => {
    const store = new InMemoryKeyValueStore();
    await saveWon(store, FIT, [LevelId.of('fit-01')]);
    const root = rootOver(
      new AnsweringLevelsApi(
        [],
        [{ gameId: 'hexa-fit', levelId: 'fit-02', reason: 'invalid-witness' }],
      ),
      store,
    );
    await flushPromises();
    const presenter = root.levelSelectorPresenter(FIT, TopologyId.hex);

    await presenter.onOpen();
    const start = await root.gameUseCases(FIT).startGame.execute({ levelId: LevelId.of('fit-02') });

    expect(presenter.viewModel().unavailable).toBeUndefined();
    expect(presenter.viewModel().levels.slice(0, 2)).toEqual([
      expect.objectContaining({ id: 'fit-01', status: 'Completado', playable: true }),
      expect.objectContaining({ id: 'fit-02', status: 'Abierto', playable: true }),
    ]);
    expect(start.ok ? 'started' : start.error.code).toBe('started');
  });
});
