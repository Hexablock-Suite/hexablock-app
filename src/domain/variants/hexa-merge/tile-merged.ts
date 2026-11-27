import type { AchievementCounters } from '../../achievements/achievement-counters';
import type { CountsForAchievements } from '../../achievements/counts-for-achievements';
import { GameEvent } from '../../engine/game-events';
import type { GameId } from '../../shared/game-id';
import type { MatchId } from '../../engine/match-id';
import { MergeTile } from './merge-tile';

// The event of one merge of a Hexa Merge slide: the tile that the merge made (issue #361).
// A slide with three merges gives three events, in the order of the merges.
// The photo of the state after the slide builds them, and `GameEngine` records them with the
// ids of the game (classes.md decision 29). A tile is a value, so the event shares it.
// Every field is private (rule R-domain-private-fields). A listener receives the data
// through `deliverTo()`.
// The event counts for the achievements (issue #406): the value of its tile is a best count.
export class TileMerged<TCell> extends GameEvent implements CountsForAchievements {
  constructor(
    gameId: GameId,
    private readonly matchId: MatchId,
    private readonly tile: TCell,
  ) {
    super(gameId);
  }

  // Gives the data of the event to `receiver`. It returns nothing.
  // Only a listener of the edge calls it (rule R-no-delivery-call).
  deliverTo(receiver: TileMergedReceiver<TCell>): void {
    this.withGameId((gameId) => receiver.receive(gameId, this.matchId, this.tile));
  }

  // Keeps the value of the made tile as the best count of the game: the highest tile
  // (issue #406). A cell that is not a `MergeTile` has no value to count, so the counters
  // do not change.
  recordIn(counters: AchievementCounters): void {
    if (this.tile instanceof MergeTile) counters.recordBest(this.tile.asAchievementCount());
  }
}

// The receiver of the data of a `TileMerged` event. A listener of the edge implements it,
// for example the counter of the tile achievements (#277). No code of `src/domain/` or
// `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface TileMergedReceiver<TCell> {
  receive(gameId: GameId, matchId: MatchId, tile: TCell): void;
}
