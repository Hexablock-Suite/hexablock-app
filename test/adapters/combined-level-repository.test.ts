/** @jest-environment node */
import { ApiLevelRepository } from '../../src/adapters/api/api-level-repository';
import type { LevelsApi } from '../../src/adapters/api/levels-api';
import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { CombinedLevelRepository } from '../../src/adapters/combined-level-repository';
import type { LevelRepository } from '../../src/application/level-repository';
import { GameId } from '../../src/domain/shared/game-id';
import { LevelDefinition } from '../../src/domain/progress/level-definition';
import { LevelId } from '../../src/domain/progress/level-id';
import { AnsweringLevelsApi } from '../support/adapters/levels-api-double';
import {
  describeLevelRepositoryContract,
  type LevelData,
} from '../support/contracts/level-repository-contract';
import { delivered } from '../support/engine/value-receiver';
import { fitLevelFile } from '../support/variants/hexa-fit/fit-level-file';

// `CombinedLevelRepository` joins the bundled levels and the levels of the backend
// (APP-FR-15, A6, DS-11, #48 and #307). The tests join a `BundledLevelRepository` over the
// given files and an `ApiLevelRepository` over a transport double that has answered.
describeLevelRepositoryContract(
  'CombinedLevelRepository',
  (levels) =>
    new CombinedLevelRepository(
      new BundledLevelRepository(levels),
      new ApiLevelRepository(new AnsweringLevelsApi([])),
    ),
);

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');

// A Fit level with the id `levelId`, the order `order` and the version `version`.
const fitLevel = (levelId: string, order: number, version = 1): LevelData => ({
  ...fitLevelFile(),
  levelId,
  order,
  version,
});

// The bundled files `bundled` joined with the backend of the transport `backend`, after the
// backend has answered once.
async function combined(
  bundled: readonly LevelData[],
  backend: LevelsApi,
): Promise<CombinedLevelRepository> {
  const api = new ApiLevelRepository(backend);
  await api.refresh();
  return new CombinedLevelRepository(new BundledLevelRepository(bundled), api);
}

// Whether `actual` holds the definitions of `expected`, in the same order.
function sameLevels(actual: readonly LevelDefinition[], expected: readonly LevelData[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every((level, at) => actual[at]?.equals(LevelDefinition.of(level)) === true)
  );
}

describe('CombinedLevelRepository', () => {
  // The check of APP-FR-15 and the Done when of #48: a backend repository that rejects counts as
  // a backend with no level, so every bundled level lists and opens, and no level is unavailable.
  it('should_give_every_bundled_level_when_the_backend_repository_rejects', async () => {
    const failure = new Error('The backend repository failed.');
    const broken: LevelRepository = {
      list: () => Promise.reject(failure),
      levelOf: () => Promise.reject(failure),
      unavailable: () => Promise.reject(failure),
    };
    const repository = new CombinedLevelRepository(new BundledLevelRepository(), broken);
    const bundled = new BundledLevelRepository();

    for (const game of [FIT, SORT]) {
      const expected = await bundled.list(game);
      const listed = await repository.list(game);
      const found = await Promise.all(
        expected.map((level) => repository.levelOf(game, level.levelId())),
      );

      expect(listed).toHaveLength(expected.length);
      expect(expected.every((level, at) => level.equals(listed[at] as LevelDefinition))).toBe(true);
      expect(found.every((level, at) => level?.equals(expected[at] as LevelDefinition))).toBe(true);
      await expect(repository.unavailable(game)).resolves.toEqual([]);
    }
  });

  // A level id that only the backend has adds a level (DS-11). It comes after the bundled levels.
  it('should_add_a_backend_level_after_the_bundled_levels_when_no_bundled_level_has_its_id', async () => {
    const added = fitLevel('fit-16', 16);
    const repository = await combined(
      [fitLevel('fit-01', 1), fitLevel('fit-02', 2)],
      new AnsweringLevelsApi([added]),
    );

    const listed = await repository.list(FIT);
    const found = await repository.levelOf(FIT, LevelId.of('fit-16'));

    expect(listed.map((level) => delivered(level.levelId()))).toEqual([
      'fit-01',
      'fit-02',
      'fit-16',
    ]);
    expect(found?.equals(LevelDefinition.of(added))).toBe(true);
  });

  // DS-11: the copy with the higher version wins, and it takes the place of the bundled copy.
  it('should_give_the_backend_copy_when_its_version_is_higher_than_the_version_of_the_bundled_copy', async () => {
    const newer = fitLevel('fit-01', 1, 2);
    const repository = await combined(
      [fitLevel('fit-01', 1), fitLevel('fit-02', 2)],
      new AnsweringLevelsApi([newer]),
    );

    const listed = await repository.list(FIT);
    const found = await repository.levelOf(FIT, LevelId.of('fit-01'));

    expect(sameLevels(listed, [newer, fitLevel('fit-02', 2)])).toBe(true);
    expect(found?.equals(LevelDefinition.of(newer))).toBe(true);
  });

  // DS-11: with equal versions the app uses the bundled copy, and an older copy never wins.
  it('should_give_the_bundled_copy_when_the_backend_copy_has_an_equal_or_a_lower_version', async () => {
    const bundled = [fitLevel('fit-01', 1, 2), fitLevel('fit-02', 2, 3)];
    const repository = await combined(
      bundled,
      new AnsweringLevelsApi([fitLevel('fit-01', 5, 2), fitLevel('fit-02', 9, 1)]),
    );

    const listed = await repository.list(FIT);
    const found = await repository.levelOf(FIT, LevelId.of('fit-02'));

    expect(sameLevels(listed, bundled)).toBe(true);
    expect(found?.equals(LevelDefinition.of(fitLevel('fit-02', 2, 3)))).toBe(true);
  });

  // Issue #307: an unavailable backend level shows only when the app has no bundled copy of it.
  // A bundled copy wins: it lists and opens.
  it('should_name_an_unavailable_backend_level_only_when_no_bundled_level_has_its_id', async () => {
    const repository = await combined(
      [fitLevel('fit-01', 1), fitLevel('fit-02', 2)],
      new AnsweringLevelsApi(
        [],
        [
          { gameId: 'hexa-fit', levelId: 'fit-02', reason: 'invalid-section' },
          { gameId: 'hexa-fit', levelId: 'fit-16', reason: 'invalid-witness' },
          { gameId: 'hexa-sort', levelId: 'sort-11', reason: 'invalid-pieces' },
        ],
      ),
    );

    const unavailable = await repository.unavailable(FIT);
    const listed = await repository.list(FIT);
    const bundledCopy = await repository.levelOf(FIT, LevelId.of('fit-02'));

    expect(unavailable.map((levelId) => delivered(levelId))).toEqual(['fit-16']);
    expect(listed.map((level) => delivered(level.levelId()))).toEqual(['fit-01', 'fit-02']);
    expect(bundledCopy?.equals(LevelDefinition.of(fitLevel('fit-02', 2)))).toBe(true);
  });

  // The bundled levels stay the source of truth: a broken bundled file still fails the call,
  // as it does with no backend.
  it('should_reject_the_list_when_a_bundled_file_is_broken_and_the_backend_answers', async () => {
    const repository = await combined(
      [{ ...fitLevel('fit-01', 1), topology: 'hexagon' }],
      new AnsweringLevelsApi([fitLevel('fit-16', 16)]),
    );

    await expect(repository.list(FIT)).rejects.toThrow(
      new RangeError('Unknown topology: hexagon.'),
    );
  });
});
