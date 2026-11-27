import {
  GameOver,
  type GameEvent,
  type GameOverReceiver,
} from '../../../src/domain/engine/game-events';
import type { GameId } from '../../../src/domain/shared/game-id';
import type { MatchId } from '../../../src/domain/engine/match-id';
import type { Outcome } from '../../../src/domain/engine/outcome';
import type { Score } from '../../../src/domain/shared/score';

// Reads a `GameOver` event as a listener of the edge does. It exists only in test/.
// The event keeps its fields private and delivers them to a receiver (issue #233).

// The data of one `GameOver` event, as its receiver gets it.
export type GameOverData = {
  readonly gameId: GameId;
  readonly matchId: MatchId;
  readonly outcome: Outcome;
  readonly finalScore: Score;
};

// A receiver double. It keeps the data of each delivery, in the order of arrival.
class RecordingGameOverReceiver implements GameOverReceiver {
  private readonly deliveries: GameOverData[] = [];

  receive(gameId: GameId, matchId: MatchId, outcome: Outcome, finalScore: Score): void {
    this.deliveries.push({ gameId, matchId, outcome, finalScore });
  }

  received(): readonly GameOverData[] {
    return [...this.deliveries];
  }
}

// The `GameOver` event that `event` is. Another event throws.
// A test may ask the class of an event. Production code never does (issue #233).
export function gameOverOf(event: GameEvent): GameOver {
  if (!(event instanceof GameOver)) throw new Error('The event is not a GameOver.');
  return event;
}

// The `GameOver` events of a list, in their order. A turn also records the events of its move
// (issue #361), so a test of the end of a game keeps only the `GameOver` events.
export function gameOversIn(events: readonly GameEvent[]): GameOver[] {
  return events.filter((event): event is GameOver => event instanceof GameOver);
}

// The data that a `GameOver` event delivers to one receiver. Another event throws,
// and so does an event that delivers its data no time or more than one time.
export function dataOf(event: GameEvent): GameOverData {
  const receiver = new RecordingGameOverReceiver();
  gameOverOf(event).deliverTo(receiver);
  const deliveries = receiver.received();
  if (deliveries.length !== 1) {
    throw new Error(`The event delivered its data ${deliveries.length} times, not 1.`);
  }
  return deliveries[0];
}
