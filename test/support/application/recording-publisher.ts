import type { GameEventPublisher } from '../../../src/application/game-event-publisher';
import type { GameEvent } from '../../../src/domain/engine/game-events';

// A double of the `GameEventPublisher` port (issue #233). It exists only in test/.
// It keeps each event that `ApplyMove` delivers, in the order of arrival.
export class RecordingPublisher implements GameEventPublisher {
  readonly events: GameEvent[] = [];

  publish(event: GameEvent): void {
    this.events.push(event);
  }
}
