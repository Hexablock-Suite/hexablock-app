/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BundledLevelRepository } from '../../src/adapters/bundled-level-repository';
import { GameId } from '../../src/domain/engine/game-id';
import { LevelDefinition } from '../../src/domain/engine/level-definition';
import { delivered } from '../support/engine/value-receiver';
import { repoRoot } from '../support/run-tool';
import { fitLevelFile } from '../support/variants/hexa-fit/fit-level-file';
import { sortLevelFile } from '../support/variants/hexa-sort/sort-level-file';

// `BundledLevelRepository` implements the `LevelRepository` port over the level files
// that the app bundles in `src/adapters/levels/<game>/` (issue #168, A6, classes.md decision 24).

const levelsDir = path.join(repoRoot, 'src/adapters/levels');

// The data of each level file in the folder of a game, in the order of the names.
function filesIn(folder: string): Parameters<typeof LevelDefinition.of>[0][] {
  const dir = path.join(levelsDir, folder);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')));
}

describe('BundledLevelRepository', () => {
  // The test reads the folders. So a new level file that the adapter does not import fails it.
  it('should_list_the_definition_of_each_bundled_file_of_the_game_when_the_game_has_levels', async () => {
    const repository = new BundledLevelRepository();

    for (const [game, folder] of [
      ['hexa-fit', 'fit'],
      ['hexa-sort', 'sort'],
    ]) {
      const listed = await repository.list(GameId.of(game));
      const expected = filesIn(folder).map((file) => LevelDefinition.of(file));

      expect([game, listed.length]).toEqual([game, expected.length]);
      expect([game, expected.every((one) => listed.some((level) => level.equals(one)))]).toEqual([
        game,
        true,
      ]);
    }
  });

  it('should_list_no_level_when_the_game_has_no_bundled_level', async () => {
    const repository = new BundledLevelRepository();

    await expect(repository.list(GameId.of('hexa-lines'))).resolves.toEqual([]);
    await expect(repository.list(GameId.of('hexa-merge'))).resolves.toEqual([]);
  });

  it('should_list_only_the_levels_of_the_game_when_the_files_of_two_games_are_given', async () => {
    const repository = new BundledLevelRepository([fitLevelFile(), sortLevelFile()]);

    const fit = await repository.list(GameId.of('hexa-fit'));
    const sort = await repository.list(GameId.of('hexa-sort'));

    expect(fit.map((level) => delivered(level.levelId()))).toEqual(['fit-01']);
    expect(sort.map((level) => delivered(level.levelId()))).toEqual(['sort-01']);
    expect(fit[0]?.equals(LevelDefinition.of(fitLevelFile()))).toBe(true);
  });

  // The repository keeps its files, so a caller that changes a list changes no later list.
  it('should_give_a_new_list_when_a_caller_empties_the_list_of_an_earlier_call', async () => {
    const repository = new BundledLevelRepository();

    const first = await repository.list(GameId.of('hexa-fit'));
    first.length = 0;
    const second = await repository.list(GameId.of('hexa-fit'));

    expect(second).toHaveLength(filesIn('fit').length);
  });
});
