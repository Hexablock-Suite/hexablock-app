/** @jest-environment node */
import { AchievementCounterListener } from '../../src/adapters/achievement-counter-listener';
import { GameEventBus } from '../../src/adapters/game-event-bus';
import { ApplyMove } from '../../src/application/apply-move';
import { GameOver } from '../../src/domain/engine/game-events';
import { GameId } from '../../src/domain/engine/game-id';
import { hex, HexAxis } from '../../src/domain/engine/hex-topology';
import { Outcome } from '../../src/domain/engine/outcome';
import { Score } from '../../src/domain/engine/score';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../src/domain/variants/hexa-lines/tray-position';
import { Slide, SlideSense } from '../../src/domain/variants/hexa-merge/slide';
import { MemoryGameRepository, valueOf } from '../support/application/game-use-cases';
import { MATCH_ID } from '../support/engine/match-id';
import { square, squareTopology } from '../support/engine/square-topology';
import { linesGame, linesState, piece } from '../support/variants/hexa-lines/lines-game';
import { mergeGame, mergeState } from '../support/variants/hexa-merge/merge-game';
import {
  place,
  row,
  sortGame,
  sortState,
  stack,
  tiles,
} from '../support/variants/hexa-sort/sort-game';

// Issue #362: the first listener of `GameEventBus` counts the events of a move of each game
// in memory. #363 gives it the port that saves the counters.

const LINES = GameId.of('hexa-lines');
const MERGE = GameId.of('hexa-merge');
const SORT = GameId.of('hexa-sort');

// Plays `move` on `engine` through `ApplyMove` and one bus with the listener.
async function playThrough(bus: GameEventBus, engine: unknown, move: unknown): Promise<void> {
  const games = new MemoryGameRepository();
  games.replace(engine as never);
  valueOf(await new ApplyMove(games, bus).execute({ move }));
}

describe('AchievementCounterListener', () => {
  it('should_count_the_events_of_each_move_by_game_when_apply_move_plays_through_the_bus', async () => {
    const bus = new GameEventBus();
    const counter = new AchievementCounterListener();
    bus.subscribe(counter);

    // A piece of two cells on (0, 0) and (1, 0) fills the row 0 and the columns 0 and 1.
    await playThrough(
      bus,
      linesGame(
        linesState(squareTopology, 3, {
          filled: [square(2, 0), square(0, 1), square(1, 1), square(0, 2), square(1, 2)],
          tray: [piece(square(0, 0), square(1, 0)), piece(square(0, 0))],
        }),
      ).engine,
      new PlacePiece(TrayPosition.of(0), square(0, 0)),
    );
    // Two pairs of equal tiles on one axis make two merges in one slide.
    await playThrough(
      bus,
      mergeGame(
        mergeState(
          [
            [hex(-2, 0), 2],
            [hex(-1, 0), 2],
            [hex(1, 0), 4],
            [hex(2, 0), 4],
          ],
          3,
        ),
      ).engine,
      Slide.of(HexAxis.q, SlideSense.forward),
    );
    await playThrough(
      bus,
      sortGame(
        sortState({
          board: row(2, [[square(0, 0), stack('green', ...tiles('red', 6))]]),
          offered: [stack(...tiles('red', 4)), stack('blue')],
        }),
      ),
      place(1),
    );

    expect(counter.countsOf(LINES)).toEqual({ linesCleared: 1, tilesMerged: 0, stacksCleared: 0 });
    expect(counter.countsOf(MERGE)).toEqual({ linesCleared: 0, tilesMerged: 2, stacksCleared: 0 });
    expect(counter.countsOf(SORT)).toEqual({ linesCleared: 0, tilesMerged: 0, stacksCleared: 1 });
  });

  it('should_count_nothing_when_the_listener_hears_only_a_game_over', () => {
    const counter = new AchievementCounterListener();

    counter.onEvent(new GameOver(LINES, MATCH_ID, Outcome.gameOver, Score.of(10)));

    expect(counter.countsOf(LINES)).toEqual({ linesCleared: 0, tilesMerged: 0, stacksCleared: 0 });
  });
});
