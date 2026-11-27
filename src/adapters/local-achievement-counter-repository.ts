import type { AchievementCounterRepository } from '../application/achievement-counter-repository';
import { AchievementCount } from '../domain/achievements/achievement-count';
import { AchievementCounters } from '../domain/achievements/achievement-counters';
import type { GameId } from '../domain/shared/game-id';
import { onlyValue, valueOf } from './delivered';
import type { KeyValueStore } from './key-value-store';
import { isObject, numberIn } from './saved-json';

// The version of the saved shape of the counters. A new shape gets a new number, so a later app
// can tell old saved counters from new ones (epic #277).
const VERSION = 1;
const INVALID = 'The saved counters of the achievements of a game are not valid.';
const UNKNOWN_VERSION =
  'The saved counters of the achievements of a game have a version that this app does not read.';

// The saved counters of one game: the version of the shape, the best count and the total.
interface SavedCounters {
  readonly version: number;
  readonly best: number;
  readonly total: number;
}

// Adapter of the `AchievementCounterRepository` port over the local storage (classes.md
// decision 57, issue #363). It keeps the counters of each game as one JSON text under the key
// `achievement-counters:<game id>` of a `KeyValueStore`, next to `progress:<game id>` of
// `LocalProgressRepository`, so the saved progress does not change.
// It follows `LocalProgressRepository` and shares its helpers (`saved-json.ts` and
// `delivered.ts`): it reads each value of the domain with `valueOf()`, which calls
// `deliverTo(receiver)` (rule R-no-delivery-call), and on a load it
// builds each count again with `AchievementCount.of()` and the counters with `start()`,
// `recordBest()` and `addToTotal()`. So the counters keep their rules on the way back.
// A saved text that is not JSON throws a `SyntaxError`. Saved counters of another version or of
// the wrong shape throw a `RangeError`, and so does a value that `AchievementCount` refuses.
// A load never writes, so the store keeps a saved text that the adapter cannot read.
export class LocalAchievementCounterRepository implements AchievementCounterRepository {
  constructor(private readonly store: KeyValueStore) {}

  async load(gameId: GameId): Promise<AchievementCounters | undefined> {
    const text = await this.store.get(keyOf(gameId));
    if (text === undefined) return undefined;
    return countersOf(gameId, JSON.parse(text));
  }

  async save(counters: AchievementCounters): Promise<void> {
    const { key, saved } = onlyValue<{ key: string; saved: SavedCounters }>((keep) =>
      counters.deliverTo({
        receive: (gameId, best, total) =>
          keep({
            key: keyOf(gameId),
            saved: { version: VERSION, best: valueOf(best), total: valueOf(total) },
          }),
      }),
    );
    await this.store.set(key, JSON.stringify(saved));
  }
}

// The key of the counters of a game in the store.
function keyOf(gameId: GameId): string {
  return `achievement-counters:${valueOf(gameId)}`;
}

// The counters of the game `gameId` from their saved JSON. Each count goes through
// `AchievementCount.of()`, which checks it.
function countersOf(gameId: GameId, data: unknown): AchievementCounters {
  if (!isObject(data)) throw new RangeError(INVALID);
  if (data.version !== VERSION) throw new RangeError(UNKNOWN_VERSION);
  const best = AchievementCount.of(numberIn(data, 'best', INVALID));
  const total = AchievementCount.of(numberIn(data, 'total', INVALID));
  const counters = AchievementCounters.start(gameId);
  counters.recordBest(best);
  counters.addToTotal(total);
  return counters;
}
