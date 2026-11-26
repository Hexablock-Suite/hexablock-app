/** @jest-environment node */
import { AchievementCounterListener } from '../../src/adapters/achievement-counter-listener';
import { GameEventBus } from '../../src/adapters/game-event-bus';
import { LocalAchievementCounterRepository } from '../../src/adapters/local-achievement-counter-repository';
import { ApplyMove } from '../../src/application/apply-move';
import type { Logger, UseCaseLogEntry } from '../../src/application/logger';
import { GameOver } from '../../src/domain/engine/game-events';
import { GameId } from '../../src/domain/engine/game-id';
import { hex, HexAxis } from '../../src/domain/engine/hex-topology';
import { Outcome } from '../../src/domain/engine/outcome';
import { Score } from '../../src/domain/engine/score';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../src/domain/variants/hexa-lines/tray-position';
import { StackCleared } from '../../src/domain/variants/hexa-sort/stack-cleared';
import { TileCount } from '../../src/domain/variants/hexa-sort/tile-count';
import { Slide, SlideSense } from '../../src/domain/variants/hexa-merge/slide';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { MemoryGameRepository, valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { countsOf } from '../support/engine/counters-content';
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

// Issue #362: the first listener of `GameEventBus` counts the events of a move of each game.
// Issue #363 gives it the `AchievementCounterRepository` port: it saves the counters of each game
// over the store, so they survive a restart. Lines keeps its most lines at once as the best count,
// Merge keeps its highest tile as the best count, and Sort adds each cleared stack, one goal,
// to the total.
// Issue #384: a failed save of the counters goes to the `Logger` port, one entry per failed save.

const LINES = GameId.of('hexa-lines');
const MERGE = GameId.of('hexa-merge');
const SORT = GameId.of('hexa-sort');

// Plays `move` on `engine` through `ApplyMove` and one bus with the listener.
async function playThrough(bus: GameEventBus, engine: unknown, move: unknown): Promise<void> {
  const games = new MemoryGameRepository();
  games.replace(engine as never);
  valueOf(await new ApplyMove(games, bus).execute({ move }));
}

// A bus with one listener that saves its counters in `store` and logs each failed save.
function counting(store = new InMemoryKeyValueStore(), logger: Logger = new RecordingLogger()) {
  const counters = new LocalAchievementCounterRepository(store);
  const listener = new AchievementCounterListener(counters, logger);
  const bus = new GameEventBus();
  bus.subscribe(listener);
  return { store, counters, listener, bus };
}

// The name, the outcome, the code and the message of each log entry, in the order of the log.
function logged(entries: readonly UseCaseLogEntry[]) {
  return entries.map(({ useCase, outcome, error }) => ({
    useCase,
    outcome,
    code: error?.code,
    message: error?.message,
  }));
}

const UNREADABLE = {
  useCase: 'AchievementCounterListener',
  outcome: 'failure',
  code: 'save-failed',
  message:
    'The saved counters of the achievements of a game have a version that this app does not read.',
};

// A piece of two cells on (0, 0) and (1, 0) fills the row 0 and the columns 0 and 1: 3 lines.
const threeLines = () => ({
  engine: linesGame(
    linesState(squareTopology, 3, {
      filled: [square(2, 0), square(0, 1), square(1, 1), square(0, 2), square(1, 2)],
      tray: [piece(square(0, 0), square(1, 0)), piece(square(0, 0))],
    }),
  ).engine,
  move: new PlacePiece(TrayPosition.of(0), square(0, 0)),
});

// A piece of one cell on (0, 0) fills the row 0 only: 1 line.
const oneLine = () => ({
  engine: linesGame(
    linesState(squareTopology, 3, {
      filled: [square(1, 0), square(2, 0)],
      tray: [piece(square(0, 0)), piece(square(0, 0))],
    }),
  ).engine,
  move: new PlacePiece(TrayPosition.of(0), square(0, 0)),
});

const SORT_GOAL = new StackCleared(SORT, MATCH_ID, 'a cell', TileCount.of(6));

describe('AchievementCounterListener', () => {
  it('should_save_the_most_lines_the_highest_tile_and_the_sort_goals_when_apply_move_plays_through_the_bus', async () => {
    const { counters, listener, bus } = counting();

    const lines = threeLines();
    await playThrough(bus, lines.engine, lines.move);
    // Two pairs of equal tiles on one axis make a tile of 4 and a tile of 8 in one slide.
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
    await listener.saved();

    expect(countsOf(await counters.load(LINES))).toEqual({ best: 3, total: 0 });
    expect(countsOf(await counters.load(MERGE))).toEqual({ best: 8, total: 0 });
    expect(countsOf(await counters.load(SORT))).toEqual({ best: 0, total: 1 });
  });

  it('should_keep_the_best_count_and_add_to_the_total_when_the_app_restarts_between_two_games', async () => {
    const first = counting();
    const lines = threeLines();
    await playThrough(first.bus, lines.engine, lines.move);
    first.listener.onEvent(SORT_GOAL);
    await first.listener.saved();

    const second = counting(first.store);
    const fewer = oneLine();
    await playThrough(second.bus, fewer.engine, fewer.move);
    second.listener.onEvent(SORT_GOAL);
    second.listener.onEvent(SORT_GOAL);
    await second.listener.saved();

    const restarted = new LocalAchievementCounterRepository(first.store);
    expect(countsOf(await restarted.load(LINES))).toEqual({ best: 3, total: 0 });
    expect(countsOf(await restarted.load(SORT))).toEqual({ best: 0, total: 3 });
  });

  it('should_save_nothing_when_the_listener_hears_only_a_game_over', async () => {
    const { store, counters, listener } = counting();

    listener.onEvent(new GameOver(LINES, MATCH_ID, Outcome.gameOver, Score.of(10)));
    await listener.saved();

    await expect(counters.load(LINES)).resolves.toBeUndefined();
    await expect(store.get('achievement-counters:hexa-lines')).resolves.toBeUndefined();
  });

  // Issue #384: a saved text that the repository cannot read stays in the store. Each failed
  // save writes one `save-failed` entry to the logger when it fails, and the listener keeps no
  // failure. The event of another game between them is still saved, and `saved()` only waits.
  it('should_log_one_save_failed_entry_per_failed_save_and_keep_the_unreadable_text_when_the_saved_counters_cannot_be_read', async () => {
    const logger = new RecordingLogger();
    const { store, counters, listener, bus } = counting(undefined, logger);
    await store.set('achievement-counters:hexa-lines', '{"version":9}');
    const first = threeLines();
    const second = oneLine();

    await playThrough(bus, first.engine, first.move);
    listener.onEvent(SORT_GOAL);
    await playThrough(bus, second.engine, second.move);
    await listener.saved();
    const afterTheSaves = logged(logger.entries);
    await listener.saved();

    expect(afterTheSaves).toEqual([UNREADABLE, UNREADABLE]);
    expect(logged(logger.entries)).toEqual([UNREADABLE, UNREADABLE]);
    await expect(store.get('achievement-counters:hexa-lines')).resolves.toBe('{"version":9}');
    expect(countsOf(await counters.load(SORT))).toEqual({ best: 0, total: 1 });
  });

  // Issue #384: a logger that throws on a failed save does not stop the queue.
  it('should_still_save_the_next_event_when_the_logger_throws_on_a_failed_save', async () => {
    const broken: Logger = {
      log: () => {
        throw new Error('The log is down.');
      },
    };
    const { store, counters, listener, bus } = counting(undefined, broken);
    await store.set('achievement-counters:hexa-lines', '{"version":9}');
    const lines = threeLines();

    await playThrough(bus, lines.engine, lines.move);
    listener.onEvent(SORT_GOAL);

    await expect(listener.saved()).resolves.toBeUndefined();
    await expect(store.get('achievement-counters:hexa-lines')).resolves.toBe('{"version":9}');
    expect(countsOf(await counters.load(SORT))).toEqual({ best: 0, total: 1 });
  });
});
