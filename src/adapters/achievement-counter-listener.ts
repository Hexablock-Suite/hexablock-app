import type { GameEvent } from '../domain/engine/game-events';
import type { GameId } from '../domain/engine/game-id';
import { LinesCleared } from '../domain/variants/hexa-lines/lines-cleared';
import { TileMerged } from '../domain/variants/hexa-merge/tile-merged';
import { StackCleared } from '../domain/variants/hexa-sort/stack-cleared';
import type { GameEventListener } from './game-event-listener';

// The counts of the events of a move that one game gave: the Lines placements that cleared
// one line or more, the merges of Merge, and the stacks that Sort cleared (one goal each).
// It is plain data of the edge.
export interface AchievementCounts {
  readonly linesCleared: number;
  readonly tilesMerged: number;
  readonly stacksCleared: number;
}

const NO_COUNTS: AchievementCounts = Object.freeze({
  linesCleared: 0,
  tilesMerged: 0,
  stacksCleared: 0,
});

// The first listener of `GameEventBus` (issue #362, part 2 of #277). It hears the events of
// a move of #361 and counts them in memory, for each game. Each event belongs to one game,
// and the listener receives its `GameId` through `deliverTo()`, as a listener of the edge
// (rule R-no-delivery-call). It ignores every other event, `GameOver` included.
// It tells one event from another by its class. The bus never does.
// The counts live only as long as the app runs. #363 gives this listener the port that saves
// the counters of the achievements, and #364 reads them in the goals. An undo takes no count
// back, because an event is a fact that happened (decision 26).
export class AchievementCounterListener implements GameEventListener {
  private readonly games: { readonly gameId: GameId; counts: AchievementCounts }[] = [];

  onEvent(event: GameEvent): void {
    if (event instanceof LinesCleared) {
      event.deliverTo({ receive: (gameId) => this.add(gameId, { linesCleared: 1 }) });
    } else if (event instanceof TileMerged) {
      event.deliverTo({ receive: (gameId) => this.add(gameId, { tilesMerged: 1 }) });
    } else if (event instanceof StackCleared) {
      event.deliverTo({ receive: (gameId) => this.add(gameId, { stacksCleared: 1 }) });
    }
  }

  // The counts of the game `gameId`. A game with no counted event has zero counts.
  countsOf(gameId: GameId): AchievementCounts {
    return this.games.find((game) => game.gameId.equals(gameId))?.counts ?? NO_COUNTS;
  }

  private add(gameId: GameId, step: Partial<AchievementCounts>): void {
    let game = this.games.find((known) => known.gameId.equals(gameId));
    if (game === undefined) {
      game = { gameId, counts: NO_COUNTS };
      this.games.push(game);
    }
    const counts = game.counts;
    game.counts = Object.freeze({
      linesCleared: counts.linesCleared + (step.linesCleared ?? 0),
      tilesMerged: counts.tilesMerged + (step.tilesMerged ?? 0),
      stacksCleared: counts.stacksCleared + (step.stacksCleared ?? 0),
    });
  }
}
