import type { AchievementCounterRepository } from '../application/achievement-counter-repository';
import { AchievementCount } from '../domain/engine/achievement-count';
import { AchievementCounters } from '../domain/engine/achievement-counters';
import type { GameEvent } from '../domain/engine/game-events';
import type { GameId } from '../domain/engine/game-id';
import { LinesCleared } from '../domain/variants/hexa-lines/lines-cleared';
import { MergeTile } from '../domain/variants/hexa-merge/merge-tile';
import { TileMerged } from '../domain/variants/hexa-merge/tile-merged';
import { StackCleared } from '../domain/variants/hexa-sort/stack-cleared';
import type { GameEventListener } from './game-event-listener';
import { valueOf } from './saved-json';

// One change of the counters of a game that one event asks for.
type Step = (counters: AchievementCounters) => void;

const ONE_GOAL = AchievementCount.of(1);

// The first listener of `GameEventBus` (issue #362, part 2 of #277). It hears the events of
// a move of #361 and saves the counters of the achievements of each game through the
// `AchievementCounterRepository` port (issue #363, part 3 of #277). The goals of #364 read them.
// - `LinesCleared`: the count of lines of the placement is a best count, the most lines at once.
// - `TileMerged`: the value of the new tile is a best count, the highest tile.
// - `StackCleared`: one goal of Hexa Sort, added to the total.
// It ignores every other event, `GameOver` included. It tells one event from another by its
// class, and it receives the data of each event through `deliverTo()`, as a listener of the
// edge (rule R-no-delivery-call). The engine names no variant, so this listener of layer 3 is the
// one place that maps the event of a variant to a generic count of `AchievementCounters`.
// An undo takes no count back, because an event is a fact that happened (decision 26).
// The bus calls `onEvent()` and waits for nothing, but the port saves asynchronously. So each
// event queues one save: it loads the counters of its game, or starts them, changes them and
// saves them. A save starts only after the save before it ends, so two events of one move never
// overwrite each other. A save that fails, for example over a saved text that the repository
// cannot read, writes nothing, and the saves after it still run. `saved()` waits for every
// queued save and throws one `Error` with the failures as its `cause`.
export class AchievementCounterListener implements GameEventListener {
  private queue: Promise<void> = Promise.resolve();
  private failures: unknown[] = [];

  constructor(private readonly counters: AchievementCounterRepository) {}

  onEvent(event: GameEvent): void {
    if (event instanceof LinesCleared) {
      event.deliverTo({
        receive: (gameId, _matchId, lines) =>
          this.enqueue(gameId, (counters) =>
            counters.recordBest(AchievementCount.of(valueOf(lines))),
          ),
      });
    } else if (event instanceof TileMerged) {
      event.deliverTo({
        receive: (gameId, _matchId, tile) => {
          if (!(tile instanceof MergeTile)) return;
          this.enqueue(gameId, (counters) =>
            counters.recordBest(AchievementCount.of(valueOf(tile))),
          );
        },
      });
    } else if (event instanceof StackCleared) {
      event.deliverTo({
        receive: (gameId) => this.enqueue(gameId, (counters) => counters.addToTotal(ONE_GOAL)),
      });
    }
  }

  // Waits for every save that the events heard so far queued. When saves failed since the last
  // call, it throws one `Error` with those failures as its `cause`, in their order.
  async saved(): Promise<void> {
    await this.queue;
    const failures = this.failures;
    this.failures = [];
    if (failures.length > 0) {
      const saves = failures.length === 1 ? 'save' : 'saves';
      throw new Error(`${failures.length} ${saves} of the achievement counters failed.`, {
        cause: failures,
      });
    }
  }

  // Queues the save of `step` on the counters of the game `gameId`.
  private enqueue(gameId: GameId, step: Step): void {
    this.queue = this.queue
      .then(() => this.save(gameId, step))
      .catch((failure: unknown) => {
        this.failures.push(failure);
      });
  }

  private async save(gameId: GameId, step: Step): Promise<void> {
    const counters = (await this.counters.load(gameId)) ?? AchievementCounters.start(gameId);
    step(counters);
    await this.counters.save(counters);
  }
}
