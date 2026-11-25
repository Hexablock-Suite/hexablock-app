import type { AchievementCounters } from '../../../src/domain/engine/achievement-counters';
import type { GameId } from '../../../src/domain/engine/game-id';
import { delivered } from './value-receiver';

// A reader of the counters of the achievements of one game. It exists only in test/.
// The counters keep their fields private and deliver them to a receiver (issue #363).

// What the counters deliver: the id of their game, the best count and the total, as numbers.
export interface CountersContent {
  readonly gameId: GameId;
  readonly best: number;
  readonly total: number;
}

// The content that `counters` deliver. Counters that deliver no content,
// or more than one content, throw.
export function countersContentOf(counters: AchievementCounters): CountersContent {
  const contents: CountersContent[] = [];
  counters.deliverTo({
    receive: (gameId, best, total) =>
      contents.push({ gameId, best: delivered(best), total: delivered(total) }),
  });
  if (contents.length !== 1) {
    throw new Error(`The counters delivered ${contents.length} contents, not 1.`);
  }
  return contents[0];
}

// The best count and the total that `counters` deliver, or `undefined` for no counters.
export function countsOf(
  counters: AchievementCounters | undefined,
): { best: number; total: number } | undefined {
  if (counters === undefined) return undefined;
  const { best, total } = countersContentOf(counters);
  return { best, total };
}
