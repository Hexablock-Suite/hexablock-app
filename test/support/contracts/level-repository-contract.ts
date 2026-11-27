import type { LevelRepository } from '../../../src/application/level-repository';
import { GameId } from '../../../src/domain/shared/game-id';
import { LevelDefinition } from '../../../src/domain/progress/level-definition';
import { LevelId } from '../../../src/domain/progress/level-id';
import { delivered } from '../engine/value-receiver';
import { fitLevelFile } from '../variants/hexa-fit/fit-level-file';
import { sortLevelFile } from '../variants/hexa-sort/sort-level-file';

const FIT = GameId.of('hexa-fit');
const LINES = GameId.of('hexa-lines');

// The data of one level in the shared level format: the common part and the section of the game.
export interface LevelData {
  readonly gameId: string;
  readonly levelId: string;
  readonly order: number;
  readonly version: number;
  readonly topology: string;
  readonly section: unknown;
}

// Two Fit levels and one Sort level. The second Fit level differs from the first by its id
// and its order, so a lookup that finds the wrong level fails.
const secondFitLevel = (): LevelData => ({ ...fitLevelFile(), levelId: 'fit-02', order: 2 });
const levels = (): LevelData[] => [fitLevelFile(), secondFitLevel(), sortLevelFile()];

// The contract of the `LevelRepository` port (classes.md decision 58, issues #168 and #172).
// Every adapter of the port runs the same suite, so they behave the same.
// `make(levels)` gives a new repository that holds the levels `levels`.
export function describeLevelRepositoryContract(
  name: string,
  make: (levels: readonly LevelData[]) => LevelRepository,
): void {
  describe(`${name} as a LevelRepository`, () => {
    it('should_list_only_the_levels_of_the_game_when_the_repository_holds_the_levels_of_two_games', async () => {
      const listed = await make(levels()).list(FIT);

      expect(listed.map((level) => delivered(level.levelId())).sort()).toEqual([
        'fit-01',
        'fit-02',
      ]);
    });

    it('should_list_no_level_when_the_game_has_no_level', async () => {
      await expect(make(levels()).list(LINES)).resolves.toEqual([]);
    });

    // Issue #172: `StartGame` starts a level from its id, so the port finds one level.
    it('should_give_the_definition_of_the_level_when_the_game_has_a_level_with_the_id', async () => {
      const found = await make(levels()).levelOf(FIT, LevelId.of('fit-02'));

      expect(found?.equals(LevelDefinition.of(secondFitLevel()))).toBe(true);
    });

    // `sort-01` is a level of another game, `fit-09` is no level,
    // and a game with no levels has no level of any id.
    it('should_give_no_level_when_the_game_has_no_level_with_the_id', async () => {
      const repository = make(levels());

      const found = [
        await repository.levelOf(FIT, LevelId.of('sort-01')),
        await repository.levelOf(FIT, LevelId.of('fit-09')),
        await repository.levelOf(LINES, LevelId.of('fit-01')),
      ];

      expect(found).toEqual([undefined, undefined, undefined]);
    });

    // Issue #307: a repository that holds only levels that it can give names no unavailable level.
    it('should_name_no_unavailable_level_when_every_level_of_the_game_can_be_given', async () => {
      const repository = make(levels());

      await expect(repository.unavailable(FIT)).resolves.toEqual([]);
      await expect(repository.unavailable(LINES)).resolves.toEqual([]);
    });
  });
}
