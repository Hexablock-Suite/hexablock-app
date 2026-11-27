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
import { AnsweringLevelsApi, UnreachableLevelsApi } from '../support/adapters/levels-api-double';
import { RecordingLogger } from '../support/application/recording-logger';
import { delivered } from '../support/engine/value-receiver';
import { ManualClock } from '../support/engine/manual-clock';

// Issues #48 and #307 through the composition root. The root takes the transport of the levels
// of the backend as the driver `levelsApi`, and the tests give it a transport double in place
// of HTTP. The root joins the bundled levels and the backend levels for every use case.

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');

// A root over the store `store` and the transport `levelsApi`.
function rootOver(levelsApi: LevelsApi, store = new InMemoryKeyValueStore()): CompositionRoot {
  return new CompositionRoot({
    clock: new ManualClock(),
    logger: new RecordingLogger(),
    store,
    levelsApi,
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
  await new LocalProgressRepository(store).save(saved);
}

describe('backend levels in the composition root', () => {
  // Done when of #48 and the check of APP-FR-15: with the network off, every bundled level opens.
  // The device keeps a won result of every level, so no level is locked.
  it('should_list_and_start_every_bundled_level_when_the_backend_does_not_answer', async () => {
    const api = new UnreachableLevelsApi();
    const store = new InMemoryKeyValueStore();
    const root = rootOver(api, store);
    const expected: string[] = [];
    const started: string[] = [];

    for (const gameId of [FIT, SORT]) {
      const bundled = await new BundledLevelRepository().list(gameId);
      await saveWon(
        store,
        gameId,
        bundled.map((level) => level.levelId()),
      );
      expected.push(...bundled.map((level) => `${delivered(level.levelId())} started`));
      for (const figure of root.figures()) {
        const listed = await root.listLevels().execute({ gameId, figure });
        for (const { levelId } of listed.ok ? listed.value.levels : []) {
          const start = await root.gameUseCases(gameId, figure).startGame.execute({ levelId });
          started.push(`${delivered(levelId)} ${start.ok ? 'started' : start.error.code}`);
        }
      }
    }

    expect(started.sort()).toEqual(expected.sort());
    expect(started).toHaveLength(37);
    expect(api.calls()).toBeGreaterThan(0);
  });

  // The check of APP-FR-15: with a bundled copy and a backend copy of one level, the copy with
  // the higher `version` loads (DS-11). The backend copy of `fit-01` holds the figure of `fit-02`.
  // With an equal version the bundled copy loads.
  it('should_start_the_backend_copy_of_a_level_only_when_its_version_is_higher', async () => {
    const spacesOfStart = async (version: number) => {
      const copy = { ...fit01, version, section: fit02.section };
      const root = rootOver(new AnsweringLevelsApi([copy]));
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
  // the player cannot start it. A bundled copy of an unavailable level wins: it lists and plays.
  it('should_show_an_unavailable_backend_level_apart_and_refuse_to_start_it_when_the_app_has_no_bundled_copy', async () => {
    const store = new InMemoryKeyValueStore();
    await saveWon(store, FIT, [LevelId.of('fit-01')]);
    const root = rootOver(
      new AnsweringLevelsApi(
        [],
        [
          { gameId: 'hexa-fit', levelId: 'fit-16', reason: 'invalid-section' },
          { gameId: 'hexa-fit', levelId: 'fit-02', reason: 'invalid-witness' },
        ],
      ),
      store,
    );
    const presenter = root.levelSelectorPresenter(FIT, TopologyId.hex);
    const start = (levelId: string) =>
      root.gameUseCases(FIT).startGame.execute({ levelId: LevelId.of(levelId) });

    await presenter.onOpen();
    const unavailable = await start('fit-16');
    const bundledCopy = await start('fit-02');

    expect(presenter.viewModel().unavailable).toEqual({
      title: 'No disponibles',
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
    expect(presenter.viewModel().levels.slice(0, 2)).toEqual([
      expect.objectContaining({ id: 'fit-01', status: 'Completado', playable: true }),
      expect.objectContaining({ id: 'fit-02', status: 'Abierto', playable: true }),
    ]);
    expect(unavailable.ok ? 'started' : unavailable.error.code).toBe('start-failed');
    expect(bundledCopy.ok ? 'started' : bundledCopy.error.code).toBe('started');
  });
});
