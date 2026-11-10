import type { GameId } from './game-id';
import type { MatchId } from './match-id';
import type { Outcome } from './outcome';

// Observer (statement §3.3). An event that the engine publishes. It is a domain event.
export abstract class GameEvent {
  constructor(readonly gameId: GameId) {}
}

// `GameEngine` builds this event after it saves the turn. So a final score that is not finite
// reaches the caller as a publish failure, and the turn stays saved.
// The event carries two ids: `gameId` says which game ended, and `matchId` says which match
// of that game (classes.md decision 30). So a listener tells two matches of one game apart.
export class GameOver extends GameEvent {
  constructor(
    gameId: GameId,
    readonly matchId: MatchId,
    readonly outcome: Outcome,
    readonly finalScore: number,
  ) {
    super(gameId);
    if (!Number.isFinite(finalScore)) {
      throw new RangeError('A game over event needs a final score that is a finite number.');
    }
  }
}

// The event sink of the engine. `GameEventBus` in layer 3 implements it.
// It is an engine interface, not a port: ports live in layer 2 (classes.md decision 25).
export interface GameEventPublisher {
  publish(event: GameEvent): void;
}
