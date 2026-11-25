import type { GameEventListener } from '../../../src/adapters/game-event-listener';
import type { GameEvent } from '../../../src/domain/engine/game-events';

// A double of a `GameEventListener` (issue #362). It exists only in test/.
// It keeps each event that the bus gives it, in the order of arrival, and writes its name
// into the shared `calls` list, so a test reads the order of the listeners.
// A listener built with `failure` keeps the event and then throws it.
export class RecordingListener implements GameEventListener {
  private readonly heard: GameEvent[] = [];

  constructor(
    private readonly name: string,
    private readonly calls: string[] = [],
    private readonly failure?: Error,
  ) {}

  onEvent(event: GameEvent): void {
    this.heard.push(event);
    this.calls.push(this.name);
    if (this.failure !== undefined) throw this.failure;
  }

  events(): readonly GameEvent[] {
    return [...this.heard];
  }
}
