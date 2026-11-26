import type { Achievement } from '../application/achievement';
import { AchievementCount } from '../domain/engine/achievement-count';
import {
  BestCountReached,
  EveryLevelWon,
  LevelsWon,
  TotalCountReached,
} from '../domain/engine/achievement-goal';
import { GameId } from '../domain/engine/game-id';

// The achievements of the player, in the order of the achievements screen (issue #188).
// They come from the team prototype, https://prototipo-hexablock.vercel.app/.
// The composition root gives them to `ListAchievements`, so this module names the games
// of each goal, and the use case never names a variant. The name of each achievement lives
// under `achievement.<id>` in the text catalog.
// The level achievements read the saved progress of a game. The other four read the saved
// counters of a game (issue #364). `AchievementCounterListener` gives each count its meaning:
// the best count of Hexa Lines is the most lines of one placement, the best count of Hexa Merge
// is the highest tile, and the total of Hexa Sort counts the goals, one per cleared stack.
// The target tile of Hexa Merge does not end the game, so `merge-2048` reads the counters too.
export function registeredAchievements(): Achievement[] {
  const lines = GameId.of('hexa-lines');
  const merge = GameId.of('hexa-merge');
  const fit = GameId.of('hexa-fit');
  const sort = GameId.of('hexa-sort');
  return [
    { id: 'lines-combo', goal: BestCountReached.of(lines, AchievementCount.of(3)) },
    { id: 'merge-256', goal: BestCountReached.of(merge, AchievementCount.of(256)) },
    { id: 'merge-2048', goal: BestCountReached.of(merge, AchievementCount.of(2048)) },
    { id: 'fit-3', goal: LevelsWon.of(fit, 3) },
    { id: 'sort-3', goal: LevelsWon.of(sort, 3) },
    { id: 'fit-all', goal: new EveryLevelWon(fit) },
    { id: 'sort-goals', goal: TotalCountReached.of(sort, AchievementCount.of(10)) },
  ];
}
