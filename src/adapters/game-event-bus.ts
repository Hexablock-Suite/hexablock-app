import type { GameEventPublisher } from '../application/ports/game-event-publisher';
import type { GameEvent } from '../domain/engine/events/game-events';
import type { GameEventListener } from './game-event-listener';

// The event bus of the app (Observer, view 4.3, issue #362). It implements the
// `GameEventPublisher` port of layer 2 (classes.md decision 25), and it is no Mediator
// (decision 35). The composition root builds one bus and gives it to every `ApplyMove`
// (single scope, decision 18).
// `publish()` gives the event to each listener in the order of subscription. The bus names
// no event class: each listener decides what an event means to it.
// A listener that throws does not stop the others. The bus gives the event to every listener,
// and then it throws one `Error` with the failures of the listeners as its `cause`, in their
// order. `ApplyMove` counts that one throw as one failed delivery (decision 29).
export class GameEventBus implements GameEventPublisher {
  private readonly listeners: GameEventListener[] = [];

  // Adds `listener` after the listeners that subscribed before it.
  // It returns the operation that removes the listener again.
  subscribe(listener: GameEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const at = this.listeners.indexOf(listener);
      if (at >= 0) this.listeners.splice(at, 1);
    };
  }

  publish(event: GameEvent): void {
    const listeners = [...this.listeners];
    const failures: unknown[] = [];
    for (const listener of listeners) {
      try {
        listener.onEvent(event);
      } catch (failure) {
        failures.push(failure);
      }
    }
    if (failures.length > 0) {
      throw new Error(`${failures.length} of ${listeners.length} listeners refused the event.`, {
        cause: failures,
      });
    }
  }
}
