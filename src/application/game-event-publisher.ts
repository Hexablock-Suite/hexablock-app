import type { GameEvent } from '../domain/engine/game-events';

// The port of the event sink (classes.md decision 25, issue #233). Layer 2 owns it,
// and `GameEventBus` in layer 3 implements it. The engine records its events and tells
// nobody: `ApplyMove` takes the events after the turn and gives each one to `publish()`.
export interface GameEventPublisher {
  publish(event: GameEvent): void;
}
