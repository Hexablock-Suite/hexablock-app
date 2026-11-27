import type { GameId } from '../shared/game-id';
import type { ValueReceiver } from '../shared/value-receiver';
import type { AchievementCounters } from './achievement-counters';

// The capability of a domain event that counts for the achievements (issue #406, classes.md
// decision 60). The rule «which event counts for which achievement» holds on paper, with no
// software, so it lives in the domain: each event of a variant applies its own count.
// - `recordIn(counters)` changes the counters of the game of the event: it keeps a best count
//   or adds to the total.
// - `deliverTo(receiver)` gives the id of the game of the event to a listener of the edge,
//   which loads the counters of that game (rule R-no-delivery-call). The receiver of each event
//   takes the game id first, so a receiver of one value fits the delivery of every event.
// The engine names no variant, and `AchievementCounterListener` names no event class:
// it asks `countsForAchievements()` and calls these two operations.
export interface CountsForAchievements {
  deliverTo(receiver: ValueReceiver<GameId>): void;
  recordIn(counters: AchievementCounters): void;
}

// Tells if `event` counts for the achievements: it has the operation `recordIn()`.
export function countsForAchievements(event: object): event is CountsForAchievements {
  return typeof (event as Partial<CountsForAchievements>).recordIn === 'function';
}
