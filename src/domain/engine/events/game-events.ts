import type { GameId } from '../../shared/game-id';
import type { MatchId } from '../match-id';
import { Outcome } from './outcome';
import type { Score } from '../../shared/score';

// Observer (statement §3.3). A domain event of a game.
// `GameEngine` records each event when it saves the turn, and tells nobody.
// `ApplyMove` takes the events after the turn and delivers them to the publisher port
// (classes.md decisions 25 and 29).
// The engine has one concrete event, `GameEnded`. The variants add the events of a move
// (issue #361): `LinesCleared`, `TileMerged` and `StackCleared`. The photo of the state
// after a move builds them with the ids that `GameEngine` gives, so the engine names
// no variant event.
// Every event belongs to one game. The base keeps the `GameId` private, and no operation
// returns it. A private member also makes the type nominal: only a subclass is a `GameEvent`.
export abstract class GameEvent {
  protected constructor(private readonly gameId: GameId) {}

  // Gives the id of the game to `deliver`, the delivery of a concrete event.
  // It returns nothing, so the id leaves the event only through that delivery.
  protected withGameId(deliver: (gameId: GameId) => void): void {
    deliver(this.gameId);
  }
}

// The event of a game that ends, with a victory or with a defeat. `GameEngine` builds it
// inside the last turn.
// Its name says only that the game ended (issue #421). A game over is a defeat only:
// `GameOverPhase` is the phase after a defeat. `Outcome.gameOver` is the outcome of a defeat.
// The final score is a `Score`, which is valid when it exists. So the event has no check
// of its own (classes.md decision 41).
// The event carries two ids: the `GameId` says which game ended, and the `MatchId` says
// which match of that game (classes.md decision 30). So a listener tells two matches of
// one game apart.
// Every field is private (rule R-domain-private-fields). A listener asks `isVictory()`,
// or it receives the data through `deliverTo()`.
export class GameEnded extends GameEvent {
  constructor(
    gameId: GameId,
    private readonly matchId: MatchId,
    private readonly outcome: Outcome,
    private readonly finalScore: Score,
  ) {
    super(gameId);
  }

  // Tells if the game ends with a victory. Any other end of a game is a defeat, a game over.
  isVictory(): boolean {
    return Outcome.victory.equals(this.outcome);
  }

  // Gives the data of the event to `receiver`. It returns nothing.
  // Only a listener of the edge calls it (rule R-no-delivery-call).
  deliverTo(receiver: GameEndedReceiver): void {
    this.withGameId((gameId) =>
      receiver.receive(gameId, this.matchId, this.outcome, this.finalScore),
    );
  }
}

// The receiver of the data of a `GameEnded` event. A listener of the edge implements it,
// for example to save the final score. No code of `src/domain/` or `src/application/`
// calls `deliverTo()` (rule R-no-delivery-call).
export interface GameEndedReceiver {
  receive(gameId: GameId, matchId: MatchId, outcome: Outcome, finalScore: Score): void;
}
