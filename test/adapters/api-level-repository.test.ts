/** @jest-environment node */
import { ApiLevelRepository } from '../../src/adapters/api/api-level-repository';
import { GameId } from '../../src/domain/shared/game-id';
import { LevelDefinition } from '../../src/domain/progress/level-definition';
import { LevelId } from '../../src/domain/progress/level-id';
import { AnsweringLevelsApi, UnreachableLevelsApi } from '../support/adapters/levels-api-double';
import { describeLevelRepositoryContract } from '../support/contracts/level-repository-contract';
import { delivered } from '../support/engine/value-receiver';
import { fitLevelFile } from '../support/variants/hexa-fit/fit-level-file';
import { sortLevelFile } from '../support/variants/hexa-sort/sort-level-file';

// `ApiLevelRepository` implements the `LevelRepository` port over the levels of hexablock-api
// (#48, A6, classes.md decision 22). It reads the answer of `GET /v1/levels` through the
// transport interface `LevelsApi` of layer 3. The tests give it a transport double.
describeLevelRepositoryContract(
  'ApiLevelRepository',
  (levels) => new ApiLevelRepository(new AnsweringLevelsApi(levels)),
);

const FIT = GameId.of('hexa-fit');
const SORT = GameId.of('hexa-sort');

describe('ApiLevelRepository', () => {
  // The backend answers each level in the shared level format, with its version (DS-6).
  it('should_give_the_definition_of_each_backend_level_of_the_game_when_the_backend_answers', async () => {
    const newer = { ...fitLevelFile(), version: 2 };
    const repository = new ApiLevelRepository(new AnsweringLevelsApi([newer, sortLevelFile()]));

    const fit = await repository.list(FIT);
    const found = await repository.levelOf(FIT, LevelId.of('fit-01'));

    expect(fit).toHaveLength(1);
    expect(fit[0]?.equals(LevelDefinition.of(newer))).toBe(true);
    expect(found?.equals(LevelDefinition.of(newer))).toBe(true);
    expect(found?.equals(LevelDefinition.of(fitLevelFile()))).toBe(false);
  });

  // Issue #307: the backend names each stored level that breaks a rule in `unavailable`.
  it('should_name_each_unavailable_level_of_the_game_when_the_backend_lists_it_as_unavailable', async () => {
    const repository = new ApiLevelRepository(
      new AnsweringLevelsApi(
        [fitLevelFile()],
        [
          { gameId: 'hexa-fit', levelId: 'fit-16', reason: 'invalid-section' },
          { gameId: 'hexa-sort', levelId: 'sort-11', reason: 'invalid-pieces' },
          { gameId: 'hexa-fit', levelId: 'fit-17', reason: 'invalid-witness' },
        ],
      ),
    );

    const fit = await repository.unavailable(FIT);
    const sort = await repository.unavailable(SORT);
    const listed = await repository.list(FIT);

    expect(fit.map((levelId) => delivered(levelId))).toEqual(['fit-16', 'fit-17']);
    expect(sort.map((levelId) => delivered(levelId))).toEqual(['sort-11']);
    expect(listed.map((level) => delivered(level.levelId()))).toEqual(['fit-01']);
  });

  // The repository keeps no copy. A backend that does not answer rejects each call, and
  // `CombinedLevelRepository` decides what the app plays without the backend.
  it('should_reject_each_call_when_the_backend_does_not_answer', async () => {
    const repository = new ApiLevelRepository(new UnreachableLevelsApi());

    await expect(repository.list(FIT)).rejects.toThrow('Network request failed');
    await expect(repository.levelOf(FIT, LevelId.of('fit-01'))).rejects.toThrow(
      'Network request failed',
    );
    await expect(repository.unavailable(FIT)).rejects.toThrow('Network request failed');
  });
});
