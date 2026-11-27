import {
  GameEnded,
  type GameEvent,
  type GameEndedReceiver,
} from '../../../src/domain/engine/game-events';
import type { GameId } from '../../../src/domain/shared/game-id';
import type { MatchId } from '../../../src/domain/engine/match-id';
import type { Outcome } from '../../../src/domain/engine/outcome';
import type { Score } from '../../../src/domain/shared/score';

// Reads a `GameEnded` event as a listener of the edge does. It exists only in test/.
// The event keeps its fields private and delivers them to a receiver (issue #233).

// The data of one `GameEnded` event, as its receiver gets it.
export type GameEndedData = {
  readonly gameId: GameId;
  readonly matchId: MatchId;
  readonly outcome: Outcome;
  readonly finalScore: Score;
};

// A receiver double. It keeps the data of each delivery, in the order of arrival.
class RecordingGameEndedReceiver implements GameEndedReceiver {
  private readonly deliveries: GameEndedData[] = [];

  receive(gameId: GameId, matchId: MatchId, outcome: Outcome, finalScore: Score): void {
    this.deliveries.push({ gameId, matchId, outcome, finalScore });
  }

  received(): readonly GameEndedData[] {
    return [...this.deliveries];
  }
}

// The `GameEnded` event that `event` is. Another event throws.
// A test may ask the class of an event. Production code never does (issue #233).
export function gameEndedOf(event: GameEvent): GameEnded {
  if (!(event instanceof GameEnded)) throw new Error('The event is not a GameEnded event.');
  return event;
}

// The `GameEnded` events of a list, in their order. A turn also records the events of its move
// (issue #361), so a test of the end of a game keeps only the `GameEnded` events.
export function gameEndedEventsIn(events: readonly GameEvent[]): GameEnded[] {
  return events.filter((event): event is GameEnded => event instanceof GameEnded);
}

// The data that a `GameEnded` event delivers to one receiver. Another event throws,
// and so does an event that delivers its data no time or more than one time.
export function dataOf(event: GameEvent): GameEndedData {
  const receiver = new RecordingGameEndedReceiver();
  gameEndedOf(event).deliverTo(receiver);
  const deliveries = receiver.received();
  if (deliveries.length !== 1) {
    throw new Error(`The event delivered its data ${deliveries.length} times, not 1.`);
  }
  return deliveries[0];
}
