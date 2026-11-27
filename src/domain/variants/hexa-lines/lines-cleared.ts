import type { AchievementCounters } from '../../achievements/achievement-counters';
import type { CountsForAchievements } from '../../achievements/counts-for-achievements';
import { GameEvent } from '../../engine/game-events';
import type { GameId } from '../../shared/game-id';
import type { MatchId } from '../../engine/match-id';
import type { LineCount } from './line-count';

// The event of one Hexa Lines placement that clears one line or more (issue #361).
// The photo of the state after the placement builds it, and `GameEngine` records it with the
// ids of the game (classes.md decision 29). It carries the combo of the placement, the count
// of the distinct full lines, and the cleared cells in the order of the wave: the order in
// which the rules found the lines, each cell once.
// The event keeps a frozen copy of the cells, so a later change of the caller list never
// reaches it. A count of no line throws a RangeError: a placement that clears no line has
// no event.
// Every field is private (rule R-domain-private-fields). A listener receives the data
// through `deliverTo()`.
// The event counts for the achievements (issue #406): its count of lines is a best count.
export class LinesCleared<TCoord> extends GameEvent implements CountsForAchievements {
  private readonly cells: readonly TCoord[];

  constructor(
    gameId: GameId,
    private readonly matchId: MatchId,
    private readonly lines: LineCount,
    cells: readonly TCoord[],
  ) {
    super(gameId);
    if (lines.isNone()) {
      throw new RangeError('A LinesCleared event needs one cleared line or more.');
    }
    this.cells = Object.freeze([...cells]);
  }

  // Gives the data of the event to `receiver`. It returns nothing.
  // Only a listener of the edge calls it (rule R-no-delivery-call).
  deliverTo(receiver: LinesClearedReceiver<TCoord>): void {
    this.withGameId((gameId) => receiver.receive(gameId, this.matchId, this.lines, this.cells));
  }

  // Keeps the count of lines of the placement as the best count of the game:
  // the most lines at once (issue #406).
  recordIn(counters: AchievementCounters): void {
    counters.recordBest(this.lines.asAchievementCount());
  }
}

// The receiver of the data of a `LinesCleared` event. A listener of the edge implements it,
// for example the counter of the combo achievement (#277). No code of `src/domain/` or
// `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface LinesClearedReceiver<TCoord> {
  receive(gameId: GameId, matchId: MatchId, lines: LineCount, cells: readonly TCoord[]): void;
}
