import { EveryLevelWon, LevelsWon, type Achievement } from '../application/achievement';
import { GameId } from '../domain/engine/game-id';

// The achievements of the player, in the order of the achievements screen (issue #188).
// They come from the team prototype, https://prototipo-hexablock.vercel.app/.
// The composition root gives them to `ListAchievements`, so this module names the games
// of each goal, and the use case never names a variant. The name of each achievement lives
// under `achievement.<id>` in the text catalog.
// The level achievements read the saved progress of a game. The other four have no goal yet:
// no game event gives the lines of one placement, the tile of a merge or the goals of a Sort game,
// so they stay in progress until those events exist.
export function registeredAchievements(): Achievement[] {
  const fit = GameId.of('hexa-fit');
  const sort = GameId.of('hexa-sort');
  return [
    { id: 'lines-combo' },
    { id: 'merge-256' },
    { id: 'merge-2048' },
    { id: 'fit-3', goal: new LevelsWon(fit, 3) },
    { id: 'sort-3', goal: new LevelsWon(sort, 3) },
    { id: 'fit-all', goal: new EveryLevelWon(fit) },
    { id: 'sort-goals' },
  ];
}
