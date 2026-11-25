import type { GameEventPublisher } from '../application/game-event-publisher';
import type { GameEvent } from '../domain/engine/game-events';

// Adapter of the `GameEventPublisher` port that does nothing (issue #162).
// Since #362 the composition root injects `GameEventBus` into `ApplyMove`, not this adapter.
// It stays for a caller that needs a publisher with no listener: the event goes nowhere.
export class NullGameEventPublisher implements GameEventPublisher {
  publish(_event: GameEvent): void {
    // It has no listener, so the event goes nowhere.
  }
}
