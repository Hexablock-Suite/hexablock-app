import { AchievementCount } from '../../achievements/achievement-count';
import type { AchievementCounters } from '../../achievements/achievement-counters';
import type { CountsForAchievements } from '../../achievements/counts-for-achievements';
import { GameEvent } from '../../engine/game-events';
import type { GameId } from '../../shared/game-id';
import type { MatchId } from '../../engine/match-id';
import type { TileCount } from './tile-count';

// One cleared stack is one goal of Hexa Sort.
const ONE_GOAL = AchievementCount.of(1);

// The event of one stack that a Hexa Sort turn clears: one goal of the level (issue #361).
// `ClearedStacks` counts the same goal in the state. A turn that clears two stacks gives two
// events, in the order of the clears. The photo of the state after the turn builds them, and
// `GameEngine` records them with the ids of the game (classes.md decision 29).
// It carries the cell of the stack and its height, the count of tiles that left the board.
// Every field is private (rule R-domain-private-fields). A listener receives the data
// through `deliverTo()`.
// The event counts for the achievements (issue #406): it adds one goal to the total.
export class StackCleared<TCoord> extends GameEvent implements CountsForAchievements {
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

  // Adds one goal of Hexa Sort to the total of the game (issue #406). The total adds the goals
  // of every Sort game of the device.
  recordIn(counters: AchievementCounters): void {
    counters.addToTotal(ONE_GOAL);
  }
}

// The receiver of the data of a `StackCleared` event. A listener of the edge implements it,
// for example the counter of the Sort goal achievement (#277). No code of `src/domain/` or
// `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface StackClearedReceiver<TCoord> {
  receive(gameId: GameId, matchId: MatchId, at: TCoord, height: TileCount): void;
}
