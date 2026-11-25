import { GameEvent } from '../../engine/game-events';
import type { GameId } from '../../engine/game-id';
import type { MatchId } from '../../engine/match-id';
import type { TileCount } from './tile-count';

// The event of one stack that a Hexa Sort turn clears: one goal of the level (issue #361).
// `ClearedStacks` counts the same goal in the state. A turn that clears two stacks gives two
// events, in the order of the clears. The photo of the state after the turn builds them, and
// `GameEngine` records them with the ids of the game (classes.md decision 29).
// It carries the cell of the stack and its height, the count of tiles that left the board.
// Every field is private (rule R-domain-private-fields). A listener receives the data
// through `deliverTo()`.
export class StackCleared<TCoord> extends GameEvent {
  constructor(
    gameId: GameId,
    private readonly matchId: MatchId,
    private readonly at: TCoord,
    private readonly height: TileCount,
  ) {
    super(gameId);
  }

  // Gives the data of the event to `receiver`. It returns nothing.
  // Only a listener of the edge calls it (rule R-no-delivery-call).
  deliverTo(receiver: StackClearedReceiver<TCoord>): void {
    this.withGameId((gameId) => receiver.receive(gameId, this.matchId, this.at, this.height));
  }
}

// The receiver of the data of a `StackCleared` event. A listener of the edge implements it,
// for example the counter of the Sort goal achievement (#277). No code of `src/domain/` or
// `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface StackClearedReceiver<TCoord> {
  receive(gameId: GameId, matchId: MatchId, at: TCoord, height: TileCount): void;
}
