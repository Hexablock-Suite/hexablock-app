import type { GameEvent } from '../../../../src/domain/engine/events/game-events';
import type { GameId } from '../../../../src/domain/shared/game-id';
import type { MatchId } from '../../../../src/domain/engine/match-id';
import {
  StackCleared,
  type StackClearedReceiver,
} from '../../../../src/domain/variants/hexa-sort/stack-cleared';
import type { TileCount } from '../../../../src/domain/variants/hexa-sort/tile-count';

// Reads a `StackCleared` event as a listener of the edge does. It exists only in test/.
// The event keeps its fields private and delivers them to a receiver (issue #361).

// The data of one `StackCleared` event, as its receiver gets it.
export type StackClearedData<TCoord> = {
  readonly gameId: GameId;
  readonly matchId: MatchId;
  readonly at: TCoord;
  readonly height: TileCount;
};

// A receiver double. It keeps the data of each delivery, in the order of arrival.
class RecordingStackClearedReceiver<TCoord> implements StackClearedReceiver<TCoord> {
  private readonly deliveries: StackClearedData<TCoord>[] = [];

  receive(gameId: GameId, matchId: MatchId, at: TCoord, height: TileCount): void {
    this.deliveries.push({ gameId, matchId, at, height });
  }

  received(): readonly StackClearedData<TCoord>[] {
    return [...this.deliveries];
  }
}

// The data that a `StackCleared` event delivers to one receiver. Another event throws,
// and so does an event that delivers its data no time or more than one time.
// A test may ask the class of an event. Production code never does (issue #233).
export function stackClearedDataOf<TCoord>(event: GameEvent): StackClearedData<TCoord> {
  if (!(event instanceof StackCleared)) throw new Error('The event is not a StackCleared.');
  const receiver = new RecordingStackClearedReceiver<TCoord>();
  (event as StackCleared<TCoord>).deliverTo(receiver);
  const deliveries = receiver.received();
  if (deliveries.length !== 1) {
    throw new Error(`The event delivered its data ${deliveries.length} times, not 1.`);
  }
  return deliveries[0];
}
