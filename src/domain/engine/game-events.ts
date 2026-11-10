import type { GameId } from './game-id';
import type { MatchId } from './match-id';
import type { Outcome } from './outcome';
import type { Score } from './score';

// Observer (statement §3.3). An event that the engine publishes. It is a domain event.
export abstract class GameEvent {
  constructor(readonly gameId: GameId) {}
}

// `GameEngine` builds this event after it saves the turn.
// The final score is a `Score`, which is valid when it exists. So the event has no check
// of its own (classes.md decision 41).
// The event carries two ids: `gameId` says which game ended, and `matchId` says which match
// of that game (classes.md decision 30). So a listener tells two matches of one game apart.
export class GameOver extends GameEvent {
  constructor(
    gameId: GameId,
    readonly matchId: MatchId,
    readonly outcome: Outcome,
    readonly finalScore: Score,
  ) {
    super(gameId);
  }
}

// The event sink of the engine. `GameEventBus` in layer 3 implements it.
// It is an engine interface, not a port: ports live in layer 2 (classes.md decision 25).
export interface GameEventPublisher {
  publish(event: GameEvent): void;
}

// What `GameEngine.tryPlay()` calls when the publisher throws after the engine saves the turn.
// It takes the thrown value. The turn and its outcome stay valid (issue 132).
export type PublishFailureHandler = (error: unknown) => void;
