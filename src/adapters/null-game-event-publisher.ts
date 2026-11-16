import type { GameEventPublisher } from '../application/game-event-publisher';
import type { GameEvent } from '../domain/engine/game-events';

// Adapter of the `GameEventPublisher` port that does nothing (issue #162).
// The composition root injects it into `ApplyMove` until `GameEventBus` of view 4.3 exists.
// `ApplyMove` delivers each event of a turn to it, and the event goes nowhere.
// No listener exists yet, so no part of the app loses an event.
export class NullGameEventPublisher implements GameEventPublisher {
  publish(_event: GameEvent): void {
    // No listener exists yet, so the event goes nowhere.
  }
}
