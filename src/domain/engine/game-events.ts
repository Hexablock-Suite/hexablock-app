import type { GameId } from './game-id';
import type { Outcome } from './outcome';

// Observer (statement §3.3). An event that the engine publishes. It is a value object.
export abstract class GameEvent {
  constructor(readonly gameId: GameId) {}
}

export class GameOver extends GameEvent {
  constructor(
    gameId: GameId,
    readonly outcome: Outcome,
    readonly finalScore: number,
  ) {
    super(gameId);
  }
}

// The event sink of the engine. `GameEventBus` in layer 3 implements it.
// It is an engine interface, not a port: ports live in layer 2 (classes.md decision 25).
export interface GameEventPublisher {
  publish(event: GameEvent): void;
}
