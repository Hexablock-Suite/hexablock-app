import type { GameEvent } from '../../../../src/domain/engine/game-events';
import type { GameId } from '../../../../src/domain/engine/game-id';
import type { MatchId } from '../../../../src/domain/engine/match-id';
import type { LineCount } from '../../../../src/domain/variants/hexa-lines/line-count';
import {
  LinesCleared,
  type LinesClearedReceiver,
} from '../../../../src/domain/variants/hexa-lines/lines-cleared';

// Reads a `LinesCleared` event as a listener of the edge does. It exists only in test/.
// The event keeps its fields private and delivers them to a receiver (issue #361).

// The data of one `LinesCleared` event, as its receiver gets it.
export type LinesClearedData<TCoord> = {
  readonly gameId: GameId;
  readonly matchId: MatchId;
  readonly lines: LineCount;
  readonly cells: readonly TCoord[];
};

// A receiver double. It keeps the data of each delivery, in the order of arrival.
class RecordingLinesClearedReceiver<TCoord> implements LinesClearedReceiver<TCoord> {
  private readonly deliveries: LinesClearedData<TCoord>[] = [];

  receive(gameId: GameId, matchId: MatchId, lines: LineCount, cells: readonly TCoord[]): void {
    this.deliveries.push({ gameId, matchId, lines, cells });
  }

  received(): readonly LinesClearedData<TCoord>[] {
    return [...this.deliveries];
  }
}

// The data that a `LinesCleared` event delivers to one receiver. Another event throws,
// and so does an event that delivers its data no time or more than one time.
// A test may ask the class of an event. Production code never does (issue #233).
export function linesClearedDataOf<TCoord>(event: GameEvent): LinesClearedData<TCoord> {
  if (!(event instanceof LinesCleared)) throw new Error('The event is not a LinesCleared.');
  const receiver = new RecordingLinesClearedReceiver<TCoord>();
  (event as LinesCleared<TCoord>).deliverTo(receiver);
  const deliveries = receiver.received();
  if (deliveries.length !== 1) {
    throw new Error(`The event delivered its data ${deliveries.length} times, not 1.`);
  }
  return deliveries[0];
}
