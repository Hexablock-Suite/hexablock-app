import type { GameEvent } from '../domain/engine/events/game-events';

// A listener of the game events (Observer, view 4.3, issue #362).
// It subscribes to `GameEventBus`, and the bus gives it each event that `ApplyMove` publishes,
// in the order of the turn. A listener that throws refuses the event. The bus still gives
// the event to the other listeners.
// The sound of #50, the animations of #293 and the counters of the achievements (#277)
// implement it. A listener of this layer imports no driver of layer 4 (rule R-adapters-imports).
export interface GameEventListener {
  onEvent(event: GameEvent): void;
}
