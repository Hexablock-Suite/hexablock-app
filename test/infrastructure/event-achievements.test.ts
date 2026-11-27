/** @jest-environment node */
import { AchievementCounterListener } from '../../src/adapters/achievement-counter-listener';
import { GameEventBus } from '../../src/adapters/game-event-bus';
import { LocalAchievementCounterRepository } from '../../src/adapters/local-achievement-counter-repository';
import type { AchievementSummary } from '../../src/application/list-achievements';
import { ApplyMove } from '../../src/application/apply-move';
import type { Result } from '../../src/application/result';
import { hex, HexAxis } from '../../src/domain/engine/hex-topology';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../src/domain/variants/hexa-lines/tray-position';
import { Slide, SlideSense } from '../../src/domain/variants/hexa-merge/slide';
import { CompositionRoot } from '../../src/infrastructure/composition-root';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { MemoryGameRepository, valueOf } from '../support/application/game-use-cases';
import { RecordingLogger } from '../support/application/recording-logger';
import { ManualClock } from '../support/engine/manual-clock';
import { square, squareTopology } from '../support/engine/square-topology';
import { linesGame, linesState, piece } from '../support/variants/hexa-lines/lines-game';
import { mergeGame, mergeState } from '../support/variants/hexa-merge/merge-game';
import {
  placeFrom,
  row,
  sortGame,
  sortState,
  stack,
  tiles,
} from '../support/variants/hexa-sort/sort-game';

// Issue #364 (part 4 of #277): the four achievements of the move events. A game plays through
// `ApplyMove` and one `GameEventBus` with `AchievementCounterListener`, which saves the counters
// over the store, as the composition root wires them. The root lists the achievements over the
// same store. A new root over the same store is a restart of the app: it builds the repositories
// and `ListAchievements` again, and the store keeps what the listener saved.

// A bus with the listener of the counters over `store`.
function counting(store: InMemoryKeyValueStore) {
  const listener = new AchievementCounterListener(
    new LocalAchievementCounterRepository(store),
    new RecordingLogger(),
  );
  const bus = new GameEventBus();
  bus.subscribe(listener);
  return { listener, bus };
}

// Plays `move` on `engine` through `ApplyMove` and the bus of `store`, and waits for the saves.
async function playThrough(store: InMemoryKeyValueStore, engine: unknown, move: unknown) {
  const { listener, bus } = counting(store);
  const games = new MemoryGameRepository();
  games.replace(engine as never);
  valueOf(await new ApplyMove(games, bus).execute({ move }));
  await listener.saved();
}

// The ids of the completed achievements that a new root over `store` lists.
async function completedOver(store: InMemoryKeyValueStore): Promise<string[] | string> {
  const root = new CompositionRoot({
    clock: new ManualClock(),
    logger: new RecordingLogger(),
    store,
  });
  return completedOf(await root.listAchievements().execute({}));
}

function completedOf(result: Result<AchievementSummary[]>): string[] | string {
  return result.ok
    ? result.value.filter(({ completed }) => completed).map(({ id }) => id)
    : result.error.code;
}

// A Lines placement that fills `filled` with the piece of the cells `cells` on (0, 0).
function linesPlay(filled: ReturnType<typeof square>[], cells: ReturnType<typeof square>[]) {
  return {
    engine: linesGame(
      linesState(squareTopology, 3, { filled, tray: [piece(...cells), piece(square(0, 0))] }),
    ).engine,
    move: new PlacePiece(TrayPosition.of(0), square(0, 0)),
  };
}

// A piece of two cells on (0, 0) and (1, 0) fills the row 0 and the columns 0 and 1: 3 lines.
const threeLines = () =>
  linesPlay(
    [square(2, 0), square(0, 1), square(1, 1), square(0, 2), square(1, 2)],
    [square(0, 0), square(1, 0)],
  );

// A piece of one cell on (0, 0) fills the row 0 and the column 0: 2 lines.
const twoLines = () =>
  linesPlay([square(1, 0), square(2, 0), square(0, 1), square(0, 2)], [square(0, 0)]);

// A Merge slide of two equal tiles of `value`: it makes one tile of twice the value.
const mergeOf = (value: number) => ({
  engine: mergeGame(
    mergeState(
      [
        [hex(-1, 0), value],
        [hex(0, 0), value],
      ],
      3,
    ),
  ).engine,
  move: Slide.of(HexAxis.q, SlideSense.forward),
});

// A Sort turn that clears one stack of six red tiles: one goal.
const oneSortGoal = () => ({
  engine: sortGame(
    sortState({
      board: row(2, [[square(0, 0), stack('green', ...tiles('red', 6))]]),
      offered: [stack(...tiles('red', 4)), stack('blue')],
    }),
  ),
  move: placeFrom(0, 1),
});

describe('CompositionRoot achievements of the move events', () => {
  it('should_complete_clear_3_lines_at_once_and_keep_it_after_a_restart_when_a_placement_clears_3_lines', async () => {
    const store = new InMemoryKeyValueStore();
    const fewer = twoLines();
    await playThrough(store, fewer.engine, fewer.move);
    const afterTwo = await completedOver(store);

    const three = threeLines();
    await playThrough(store, three.engine, three.move);

    expect(afterTwo).toEqual([]);
    expect(await completedOver(store)).toEqual(['lines-combo']);
    expect(await completedOver(store)).toEqual(['lines-combo']);
  });

  it('should_complete_reach_256_and_then_reach_2048_and_keep_them_after_a_restart_when_merges_make_those_tiles', async () => {
    const store = new InMemoryKeyValueStore();
    const small = mergeOf(64);
    await playThrough(store, small.engine, small.move);
    const after128 = await completedOver(store);

    const middle = mergeOf(128);
    await playThrough(store, middle.engine, middle.move);
    const after256 = await completedOver(store);

    const large = mergeOf(1024);
    await playThrough(store, large.engine, large.move);

    expect(after128).toEqual([]);
    expect(after256).toEqual(['merge-256']);
    expect(await completedOver(store)).toEqual(['merge-256', 'merge-2048']);
    expect(await completedOver(store)).toEqual(['merge-256', 'merge-2048']);
  });

  // One Sort goal is one cleared stack (#361). The total adds the goals of every Sort game.
  it('should_complete_10_sort_goals_and_keep_it_after_a_restart_when_ten_sort_turns_clear_a_stack', async () => {
    const store = new InMemoryKeyValueStore();
    for (let game = 0; game < 9; game += 1) {
      const turn = oneSortGoal();
      await playThrough(store, turn.engine, turn.move);
    }
    const afterNine = await completedOver(store);

    const tenth = oneSortGoal();
    await playThrough(store, tenth.engine, tenth.move);

    expect(afterNine).toEqual([]);
    expect(await completedOver(store)).toEqual(['sort-goals']);
    expect(await completedOver(store)).toEqual(['sort-goals']);
  });
});
