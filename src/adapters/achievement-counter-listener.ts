import type { AchievementCounterRepository } from '../application/ports/achievement-counter-repository';
import type { Logger } from '../application/aspects/logger';
import { caughtError, FailureCode } from '../application/result';
import { AchievementCounters } from '../domain/achievements/achievement-counters';
import {
  countsForAchievements,
  type CountsForAchievements,
} from '../domain/achievements/counts-for-achievements';
import type { GameEvent } from '../domain/engine/events/game-events';
import type { GameId } from '../domain/shared/game-id';
import type { GameEventListener } from './game-event-listener';

// The first listener of `GameEventBus` (issue #362, part 2 of #277). It hears the events of
// a move of #361 and saves the counters of the achievements of each game through the
// `AchievementCounterRepository` port (issue #363, part 3 of #277). The goals of #364 read them.
// Each event that counts for the achievements implements `CountsForAchievements` of the domain
// and records its own count (issue #406, classes.md decision 60). So the listener names no
// event class and imports no variant (rule `achievement-listener-no-variants`):
// - `LinesCleared` keeps its count of lines as a best count, the most lines at once.
// - `TileMerged` keeps the value of its tile as a best count, the highest tile.
// - `StackCleared` adds one goal of Hexa Sort to the total.
// It ignores every other event, `GameEnded` included. It receives the game id of an event through
// `deliverTo()`, as a listener of the edge (rule R-no-delivery-call).
// An undo takes no count back, because an event is a fact that happened (decision 26).
// The bus calls `onEvent()` and waits for nothing, but the port saves asynchronously. So each
// event queues one save: it loads the counters of its game, or starts them, lets the event record
// its count in them and saves them. A save starts only after the save before it ends, so two
// events of one move never overwrite each other. A save that fails, for example over a saved text
// that the repository cannot read, writes nothing, and the saves after it still run. The listener
// reports each failed save at once through the `Logger` port of layer 2 (issue #384). The entry
// names this listener and holds a `save-failed` `UseCaseError` with the thrown value as its
// `cause`. The listener keeps no failure. A logger that throws stops no save. `saved()` waits
// for every queued save.
export class AchievementCounterListener implements GameEventListener {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly counters: AchievementCounterRepository,
    private readonly logger: Logger,
  ) {}

  onEvent(event: GameEvent): void {
    if (!countsForAchievements(event)) return;
    event.deliverTo({ receive: (gameId) => this.enqueue(gameId, event) });
  }

  // Waits for every save that the events heard so far queued. It never throws: the logger
  // already has each failed save.
  async saved(): Promise<void> {
    await this.queue;
  }

  // Queues the save of the count of `event` in the counters of the game `gameId`.
  private enqueue(gameId: GameId, event: CountsForAchievements): void {
    this.queue = this.queue
      .then(() => this.save(gameId, event))
      .catch((failure: unknown) => this.report(failure));
  }

  // Writes one `save-failed` entry for the failed save to the logger.
  // A logger that throws has no other place to report to, so the listener ignores its error.
  private report(failure: unknown): void {
    try {
      this.logger.log({
        useCase: 'AchievementCounterListener',
        outcome: 'failure',
        error: caughtError(FailureCode.saveFailed, failure),
      });
    } catch {
      // The queue goes on with the next save.
    }
  }

  private async save(gameId: GameId, event: CountsForAchievements): Promise<void> {
    const counters = (await this.counters.load(gameId)) ?? AchievementCounters.start(gameId);
    event.recordIn(counters);
    await this.counters.save(counters);
  }
}
