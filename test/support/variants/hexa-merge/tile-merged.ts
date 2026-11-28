import type { GameEvent } from '../../../../src/domain/engine/events/game-events';
import type { GameId } from '../../../../src/domain/shared/game-id';
import type { MatchId } from '../../../../src/domain/engine/match-id';
import {
  TileMerged,
  type TileMergedReceiver,
} from '../../../../src/domain/variants/hexa-merge/tile-merged';

// Reads a `TileMerged` event as a listener of the edge does. It exists only in test/.
// The event keeps its fields private and delivers them to a receiver (issue #361).

// The data of one `TileMerged` event, as its receiver gets it.
export type TileMergedData<TCell> = {
  readonly gameId: GameId;
  readonly matchId: MatchId;
  readonly tile: TCell;
};

// A receiver double. It keeps the data of each delivery, in the order of arrival.
class RecordingTileMergedReceiver<TCell> implements TileMergedReceiver<TCell> {
  private readonly deliveries: TileMergedData<TCell>[] = [];

  receive(gameId: GameId, matchId: MatchId, tile: TCell): void {
    this.deliveries.push({ gameId, matchId, tile });
  }

  received(): readonly TileMergedData<TCell>[] {
    return [...this.deliveries];
  }
}

// The data that a `TileMerged` event delivers to one receiver. Another event throws,
// and so does an event that delivers its data no time or more than one time.
// A test may ask the class of an event. Production code never does (issue #233).
export function tileMergedDataOf<TCell>(event: GameEvent): TileMergedData<TCell> {
  if (!(event instanceof TileMerged)) throw new Error('The event is not a TileMerged.');
  const receiver = new RecordingTileMergedReceiver<TCell>();
  (event as TileMerged<TCell>).deliverTo(receiver);
  const deliveries = receiver.received();
  if (deliveries.length !== 1) {
    throw new Error(`The event delivered its data ${deliveries.length} times, not 1.`);
  }
  return deliveries[0];
}
