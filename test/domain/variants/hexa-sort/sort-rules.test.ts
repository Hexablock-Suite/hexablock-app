/** @jest-environment node */
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Board } from '../../../../src/domain/engine/board';
import { PlayingPhase } from '../../../../src/domain/engine/game-phase';
import { Moves } from '../../../../src/domain/shared/moves';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { SeededPieceSource } from '../../../../src/domain/engine/piece-source';
import { Seed } from '../../../../src/domain/engine/seed';
import { BaseGameRules } from '../../../../src/domain/engine/rules';
import { Color } from '../../../../src/domain/engine/color';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { ClearedStacks } from '../../../../src/domain/variants/hexa-sort/cleared-stacks';
import { ColorStack } from '../../../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../../../../src/domain/variants/hexa-sort/sort-level';
import { SortRules } from '../../../../src/domain/variants/hexa-sort/sort-rules';
import type { SortSnapshot, SortState } from '../../../../src/domain/variants/hexa-sort/sort-state';
import { TileCount } from '../../../../src/domain/variants/hexa-sort/tile-count';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import {
  chipsAt,
  names,
  placeFrom,
  row,
  sortGame,
  sortState,
  stack,
  tiles,
  trayOf,
} from '../../../support/variants/hexa-sort/sort-game';
import { BOARD_ID } from '../../../support/engine/entity-ids';
import type { IScoringPolicy } from '../../../../src/domain/engine/scoring-policy';
import { playMove } from '../../../support/engine/play-move';
import { startVariant } from '../../../support/engine/variant-game';
import { seededRandom } from '../../../support/engine/step-random';
import { ManualClock } from '../../../support/engine/manual-clock';

// The rules of issue #93 and the accepted rules of issue #56: a tie goes to the stack
// whose coordinate key comes first in key order.
// The turn tests drive the game through `GameEngine`, so they use only the rules contract.

describe('SortRules contract', () => {
  it('should_extend_the_base_rules_when_the_variant_implements_the_contract', () => {
    expect(new SortRules()).toBeInstanceOf(BaseGameRules);
  });
});

// Issue #353, decision of 2026-11-24: Sort offers a tray of three stacks, as the team prototype.
// The player chooses one slot, and a used slot stays empty until the tray refills.
describe('SortRules tray', () => {
  it('should_place_the_stack_of_the_second_slot_and_keep_the_other_slots_when_the_second_slot_is_chosen', () => {
    const game = sortGame(
      sortState({
        board: row(4),
        offered: [stack('red'), stack('blue', 'green'), stack('green'), stack('yellow')],
      }),
    );
    expect(trayOf(game.snapshot())).toEqual([['red'], ['blue', 'green'], ['green']]);

    expect(playMove(game, placeFrom(1, 2))).toBe(Outcome.playing);

    expect(chipsAt(game, 2)).toEqual(['blue', 'green']);
    expect(trayOf(game.snapshot())).toEqual([['red'], [], ['green']]);
    expect(game.snapshot().moveCount()).toEqual(Moves.of(1));
  });

  it('should_fill_the_tray_with_the_next_three_stacks_of_the_source_when_the_three_slots_are_used', () => {
    const game = sortGame(
      sortState({
        board: row(6),
        offered: [
          stack('red'),
          stack('blue'),
          stack('green'),
          stack('yellow'),
          stack('red', 'blue'),
          stack('green', 'yellow'),
          stack('blue'),
        ],
      }),
    );

    playMove(game, placeFrom(2, 4));
    playMove(game, placeFrom(0, 0));
    expect(trayOf(game.snapshot())).toEqual([[], ['blue'], []]);
    playMove(game, placeFrom(1, 2));

    expect(trayOf(game.snapshot())).toEqual([['yellow'], ['red', 'blue'], ['green', 'yellow']]);
    expect([chipsAt(game, 0), chipsAt(game, 2), chipsAt(game, 4)]).toEqual([
      ['red'],
      ['blue'],
      ['green'],
    ]);
    expect(game.snapshot().moveCount()).toEqual(Moves.of(3));
  });

  it('should_count_only_accepted_moves_when_placements_are_accepted_and_rejected', () => {
    const game = sortGame(sortState({ board: row(3), offered: [stack('red'), stack('blue')] }));

    expect(game.snapshot().moveCount()).toEqual(Moves.of(0));

    expect(game.tryPlay(placeFrom(0, 0)).wasAccepted()).toBe(true);
    expect(game.snapshot().moveCount()).toEqual(Moves.of(1));

    expect(game.tryPlay(placeFrom(1, 0)).wasAccepted()).toBe(false);
    expect(game.snapshot().moveCount()).toEqual(Moves.of(1));

    expect(game.tryPlay(placeFrom(1, 2)).wasAccepted()).toBe(true);
    expect(game.snapshot().moveCount()).toEqual(Moves.of(2));
  });

  it('should_reject_the_move_and_keep_the_tray_when_the_slot_holds_no_stack', () => {
    const game = sortGame(
      sortState({ board: row(4), offered: [stack('red'), stack('blue'), stack('green')] }),
    );
    playMove(game, placeFrom(1, 0));

    expect(game.tryPlay(placeFrom(1, 2)).wasAccepted()).toBe(false);
    expect(game.tryPlay(placeFrom(3, 2)).wasAccepted()).toBe(false);

    expect(chipsAt(game, 2)).toEqual([]);
    expect(trayOf(game.snapshot())).toEqual([['red'], [], ['green']]);
    expect(game.snapshot().moveCount()).toEqual(Moves.of(1));
  });

  it('should_reject_the_move_and_keep_the_state_when_the_cell_holds_a_stack', () => {
    const game = sortGame(
      sortState({ board: row(3, [[square(0, 0), stack('green')]]), offered: [stack('red')] }),
    );

    expect(playMove(game, placeFrom(0, 0))).toBe(Outcome.playing);

    expect(chipsAt(game, 0)).toEqual(['green']);
    expect(trayOf(game.snapshot())).toEqual([['red'], [], []]);
  });

  it('should_reject_the_move_when_the_cell_is_outside_the_board', () => {
    const game = sortGame(sortState({ board: row(2), offered: [stack('red')] }));

    expect(playMove(game, placeFrom(0, 5))).toBe(Outcome.playing);

    expect(game.snapshot().boardCopy().occupiedCells()).toEqual([]);
    expect(trayOf(game.snapshot())).toEqual([['red'], [], []]);
  });

  // «Propuesta, pendiente del equipo» of #353: a fixed list with fewer than three stacks left
  // offers the stacks that are left, and the other slots stay empty.
  it('should_offer_the_stacks_that_are_left_when_the_fixed_list_holds_fewer_than_three', () => {
    const game = sortGame(
      sortState({
        board: row(6),
        offered: [stack('red'), stack('blue'), stack('green'), stack('yellow')],
      }),
    );

    playMove(game, placeFrom(0, 0));
    playMove(game, placeFrom(1, 2));
    expect(playMove(game, placeFrom(2, 4))).toBe(Outcome.playing);

    expect(trayOf(game.snapshot())).toEqual([['yellow'], [], []]);
  });
});

describe('SortRules transfer', () => {
  it('should_move_the_whole_top_run_to_the_stack_with_the_longer_run_when_neighbors_share_the_top_color', () => {
    // The left stack holds three reds, but its top run is one red. The placed run is two.
    const game = sortGame(
      sortState({
        board: row(2, [[square(0, 0), stack('red', 'red', 'blue', 'red')]]),
        offered: [stack('green', 'red', 'red')],
      }),
    );

    playMove(game, placeFrom(0, 1));

    expect(chipsAt(game, 0)).toEqual(['red', 'red', 'blue']);
    expect(chipsAt(game, 1)).toEqual(['green', 'red', 'red', 'red']);
  });

  it('should_move_the_placed_run_to_the_neighbor_when_the_neighbor_has_the_longer_run', () => {
    const game = sortGame(
      sortState({
        board: row(2, [[square(0, 0), stack('blue', 'red', 'red')]]),
        offered: [stack('green', 'red')],
      }),
    );

    playMove(game, placeFrom(0, 1));

    expect(chipsAt(game, 0)).toEqual(['blue', 'red', 'red', 'red']);
    expect(chipsAt(game, 1)).toEqual(['green']);
  });

  it('should_move_to_the_stack_whose_coordinate_key_comes_first_when_two_stacks_tie', () => {
    // The board holds (2, 0) before (0, 0), so (2, 0) comes first in `board.occupiedCells()`.
    // The key `0,0` comes before the key `2,0`, so (0, 0) wins the tie (issue #56).
    const game = sortGame(
      sortState({
        board: row(3, [
          [square(2, 0), stack('red', 'red')],
          [square(0, 0), stack('red', 'red')],
        ]),
        offered: [stack('red')],
      }),
    );

    playMove(game, placeFrom(0, 1));

    expect(chipsAt(game, 0)).toEqual(['red', 'red', 'red']);
    expect(chipsAt(game, 2)).toEqual(['red', 'red']);
    expect(chipsAt(game, 1)).toEqual([]);
  });

  it('should_move_tiles_again_in_cascade_when_a_transfer_uncovers_a_matching_top', () => {
    // Red leaves (1, 0) for the placed stack. Blue then tops (1, 0) and joins (0, 0).
    const game = sortGame(
      sortState({
        board: row(3, [
          [square(0, 0), stack('blue', 'blue')],
          [square(1, 0), stack('blue', 'red')],
        ]),
        offered: [stack('red', 'red')],
      }),
    );

    playMove(game, placeFrom(0, 2));

    expect(chipsAt(game, 2)).toEqual(['red', 'red', 'red']);
    expect(chipsAt(game, 1)).toEqual([]);
    expect(chipsAt(game, 0)).toEqual(['blue', 'blue', 'blue']);
    expect(game.snapshot().moveCount()).toEqual(Moves.of(1));
  });
});

describe('SortRules goal', () => {
  it('should_remove_the_whole_stack_and_count_a_goal_when_a_top_run_reaches_ten', () => {
    const game = sortGame(
      sortState({
        board: row(2, [[square(0, 0), stack('green', ...tiles('red', 6))]]),
        offered: [stack(...tiles('red', 4)), stack('blue')],
      }),
    );

    expect(playMove(game, placeFrom(0, 1))).toBe(Outcome.playing);

    const state = game.snapshot();
    expect(chipsAt(game, 0)).toEqual([]);
    expect(chipsAt(game, 1)).toEqual([]);
    expect(state.goalsReached()).toEqual(ClearedStacks.of(1));
    expect(state.clearedStackHeights()).toEqual([TileCount.of(11)]);
    expect(state.moveCount()).toEqual(Moves.of(1));
  });

  it('should_keep_the_stack_when_its_top_run_is_nine', () => {
    const game = sortGame(
      sortState({
        board: row(2, [[square(0, 0), stack(...tiles('red', 6))]]),
        offered: [stack(...tiles('red', 3)), stack('blue')],
      }),
    );

    playMove(game, placeFrom(0, 1));

    expect(chipsAt(game, 0)).toEqual(tiles('red', 9));
    expect(game.snapshot().goalsReached()).toEqual(ClearedStacks.of(0));
    expect(game.snapshot().clearedStackHeights()).toEqual([]);
  });

  it('should_forget_the_cleared_stacks_of_the_last_turn_when_a_new_turn_starts', () => {
    const game = sortGame(
      sortState({
        board: row(3, [[square(0, 0), stack(...tiles('red', 6))]]),
        offered: [stack(...tiles('red', 4)), stack('blue'), stack('green')],
      }),
    );

    playMove(game, placeFrom(0, 1));
    playMove(game, placeFrom(1, 2));

    expect(game.snapshot().goalsReached()).toEqual(ClearedStacks.of(1));
    expect(game.snapshot().clearedStackHeights()).toEqual([]);
  });
});

describe('SortRules end of the game', () => {
  it('should_win_when_the_goals_done_reach_the_goals_needed', () => {
    const game = sortGame(
      sortState({
        board: row(3, [[square(0, 0), stack(...tiles('red', 6))]]),
        offered: [stack(...tiles('red', 4)), stack('blue')],
        goalsNeeded: 1,
      }),
    );

    expect(playMove(game, placeFrom(0, 1))).toBe(Outcome.victory);
  });

  it('should_lose_when_the_board_is_full', () => {
    const game = sortGame(
      sortState({ board: row(2), offered: [stack('red'), stack('blue'), stack('green')] }),
    );

    expect(playMove(game, placeFrom(0, 0))).toBe(Outcome.playing);
    expect(playMove(game, placeFrom(1, 1))).toBe(Outcome.gameOver);
  });

  it('should_lose_when_the_fixed_list_has_no_stack_left', () => {
    const game = sortGame(sortState({ board: row(3), offered: [stack('red')] }));

    expect(playMove(game, placeFrom(0, 0))).toBe(Outcome.gameOver);
    expect(trayOf(game.snapshot())).toEqual([[], [], []]);
  });
});

describe('SortRules colors', () => {
  it('should_throw_a_range_error_when_a_sort_tile_has_an_empty_color_name', () => {
    // A Sort tile holds the engine `Color`, so it rejects an empty name as Lines does (#129).
    for (const name of ['', ' ']) {
      expect(() => stack('red', name)).toThrow(new RangeError('A color needs a name.'));
    }
  });

  it('should_move_the_tiles_when_two_stacks_hold_equal_colors_made_apart', () => {
    // `Color.of()` makes a new object on each call, so the rules compare colors by name.
    const game = sortGame(
      sortState({
        board: row(2, [[square(0, 0), stack('blue', 'red', 'red')]]),
        offered: [stack('red')],
      }),
    );

    playMove(game, placeFrom(0, 1));

    expect(chipsAt(game, 0)).toEqual(['blue', 'red', 'red', 'red']);
    expect(chipsAt(game, 1)).toEqual([]);
  });
});

// The first `count` stacks that a new source of `level` gives.
function drawnStacks(level: SortLevel, count: number): ColorStack[] {
  const found: ColorStack[] = [];
  const factory = new SortFactory(new SquareGeometry(), level, seededRandom(1), new ManualClock());
  for (const drawn of factory.createPieceSource()) {
    if (found.length === count) break;
    found.push(drawn);
  }
  return found;
}

// The runs of `drawn` from the bottom to the top, as color names.
// A run is the top run of what stays when the runs above it leave (D21).
function runsOf(drawn: ColorStack): string[][] {
  const found: string[][] = [];
  for (let rest = drawn; !rest.isEmpty(); rest = rest.withoutTopRun()) {
    found.unshift(names(ColorStack.of(rest.topRun())));
  }
  return found;
}

// What a drawn stack breaks of the rule of issue #352: its height, its count of runs,
// a color outside the level, and two runs next to each other with one color.
function brokenRules(drawn: ColorStack, colors: readonly string[]): string[] {
  const runs = runsOf(drawn);
  const height = runs.flat().length;
  const tops = runs.map(([color]) => color);
  return [
    (height >= 2 && height <= 6) || `height ${height}`,
    (runs.length >= 1 && runs.length <= Math.min(3, colors.length)) || `${runs.length} runs`,
    tops.every((color) => color !== undefined && colors.includes(color)) || 'color',
    tops.every((color, i) => i === 0 || color !== tops[i - 1]) || 'two runs of one color',
  ].filter((check): check is string => check !== true);
}

const seededLevel = (seed: number, colors: readonly string[]) =>
  SortLevel.seeded(
    RegionSize.of(2),
    GoalCount.of(3),
    Seed.of(seed),
    colors.map((name) => Color.of(name)) as [Color, ...Color[]],
  );

describe('SortRules piece source (A4)', () => {
  // Issue #352, decision of 2026-11-24: a seeded stack follows the team prototype.
  // It holds 2 to 6 tiles in 1 to 3 runs, and two runs next to each other have other colors.
  // The transfer reads the top run (D21), so the test also checks the run on top.
  it('should_draw_stacks_of_2_to_6_tiles_in_1_to_3_runs_of_the_level_colors_when_a_seeded_level_gives_stacks', () => {
    const colors = ['red', 'green', 'blue'];

    const drawn = drawnStacks(seededLevel(20261115, colors), 300);

    expect(drawn.flatMap((each) => brokenRules(each, colors))).toEqual([]);
    expect(new Set(drawn.map((each) => runsOf(each).flat().length))).toEqual(
      new Set([2, 3, 4, 5, 6]),
    );
    expect(new Set(drawn.map((each) => runsOf(each).length))).toEqual(new Set([1, 2, 3]));
    for (const each of drawn) {
      expect(names(ColorStack.of(each.topRun()))).toEqual(runsOf(each).at(-1));
    }
  });

  // The count of runs is never more than the colors of the level (issue #352).
  it('should_draw_no_more_runs_than_the_level_colors_when_a_seeded_level_has_one_or_two_colors', () => {
    const one = drawnStacks(seededLevel(7, ['blue']), 100);
    const two = drawnStacks(seededLevel(7, ['red', 'blue']), 100);

    expect(one.flatMap((each) => brokenRules(each, ['blue']))).toEqual([]);
    expect(new Set(one.map((each) => runsOf(each).length))).toEqual(new Set([1]));
    expect(two.flatMap((each) => brokenRules(each, ['red', 'blue']))).toEqual([]);
    expect(new Set(two.map((each) => runsOf(each).length))).toEqual(new Set([1, 2]));
  });

  // APP-NFR-07: one seed gives the same stacks, so two games of one seeded level play the same.
  it('should_offer_the_same_stacks_when_two_games_use_the_same_seed', () => {
    const level = seededLevel(7, ['red', 'blue', 'green']);
    const play = () => {
      const factory = new SortFactory(
        new SquareGeometry(),
        level,
        seededRandom(1),
        new ManualClock(),
      );
      const { engine } = startVariant(factory);
      const tray = trayOf(engine.snapshot());
      playMove(engine, placeFrom(1, 0, 0));
      playMove(engine, placeFrom(0, 1, 1));
      return {
        tray,
        after: trayOf(engine.snapshot()),
        board: [chipsAt(engine, 0), chipsAt(engine, 1, 1)],
      };
    };

    const first = play();

    expect(first.tray.map((slot) => slot.length >= 2)).toEqual([true, true, true]);
    expect(play()).toEqual(first);
  });
});

// Edge cases of the walkthrough of PR #108 (issue #120).
describe('SortRules edge cases', () => {
  // A 3 × 3 square board with the given stacks, in the order of the list.
  function grid(content: readonly [SquareCoord, ColorStack][]): Board<ColorStack, SquareCoord> {
    const board = new Board<ColorStack, SquareCoord>(
      BOARD_ID,
      squareTopology.region(RegionSize.of(3)),
      squareTopology,
    );
    for (const [at, cell] of content) board.occupy(at, cell);
    return board;
  }

  it('should_break_the_tie_by_the_coordinate_key_when_a_stack_is_placed_on_a_cleared_cell', () => {
    // A tie goes to the stack whose coordinate key comes first (issue #56), never to the stack
    // that comes first in `board.occupiedCells()`. A cleared cell keeps an empty stack (sort-state.ts),
    // so it keeps its old place in that order. The key order does not depend on that history (G108.3).
    const game = sortGame(
      sortState({
        board: row(3, [
          [square(1, 0), stack(...tiles('green', 9))],
          [square(0, 0), stack('blue', 'red')],
        ]),
        offered: [stack('green'), stack('red'), stack('blue')],
      }),
    );

    // The green tile joins the nine greens on (1, 0), and the ten greens clear that stack.
    playMove(game, placeFrom(0, 2));
    expect(game.snapshot().goalsReached()).toEqual(ClearedStacks.of(1));
    expect(chipsAt(game, 1)).toEqual([]);

    // The placed red on (1, 0) ties with the red on (0, 0). The cell (1, 0) comes first
    // in `board.occupiedCells()`, but the key `0,0` comes before the key `1,0`, so (0, 0) wins.
    playMove(game, placeFrom(1, 1));

    expect(chipsAt(game, 0)).toEqual(['blue', 'red', 'red']);
    expect(chipsAt(game, 1)).toEqual([]);
    expect(chipsAt(game, 2)).toEqual([]);
  });

  it('should_clear_the_placed_stack_and_count_a_goal_when_its_top_run_already_holds_ten_or_more', () => {
    // A top run of 10 or more removes the whole stack and counts one goal (issue #56).
    // The cascade starts at the placed stack (sort-rules.ts), so no neighbor is needed.
    const game = sortGame(
      sortState({
        board: row(3),
        offered: [stack('blue', ...tiles('red', 12)), stack('green')],
        goalsNeeded: 2,
      }),
    );

    const outcome = playMove(game, placeFrom(0, 1));

    const state = game.snapshot();
    expect(outcome).toBe(Outcome.playing);
    expect(chipsAt(game, 1)).toEqual([]);
    expect(state.goalsReached()).toEqual(ClearedStacks.of(1));
    expect(state.clearedStackHeights()).toEqual([TileCount.of(13)]);
    expect(trayOf(state)).toEqual([[], ['green'], []]);
  });

  it('should_take_the_top_runs_of_every_matching_neighbor_when_the_placed_stack_has_the_longest_run', () => {
    // When the placed stack is the target, every matching neighbor gives its run to it (sort-rules.ts).
    const ring = [square(1, 0), square(2, 1), square(1, 2), square(0, 1)];
    const game = sortGame(
      sortState({
        board: grid(ring.map((at) => [at, stack('blue', 'red')])),
        offered: [stack('red', 'red'), stack('green')],
      }),
    );

    playMove(game, placeFrom(0, 1, 1));

    expect(chipsAt(game, 1, 1)).toEqual(tiles('red', 6));
    for (const at of ring)
      expect(names(game.snapshot().boardCopy().occupantAt(at))).toEqual(['blue']);
  });

  it('should_give_only_the_placed_run_when_a_neighbor_has_the_longest_run', () => {
    // Otherwise only the placed stack gives its run, because the other neighbors
    // can lie away from the target (sort-rules.ts).
    const others = [square(2, 1), square(1, 2), square(0, 1)];
    const game = sortGame(
      sortState({
        board: grid([
          [square(1, 0), stack(...tiles('red', 3))],
          ...others.map((at): [SquareCoord, ColorStack] => [at, stack('blue', 'red')]),
        ]),
        offered: [stack('red', 'red'), stack('green')],
      }),
    );

    playMove(game, placeFrom(0, 1, 1));

    expect(chipsAt(game, 1, 0)).toEqual(tiles('red', 5));
    expect(chipsAt(game, 1, 1)).toEqual([]);
    for (const at of others)
      expect(names(game.snapshot().boardCopy().occupantAt(at))).toEqual(['blue', 'red']);
  });

  it('should_throw_and_keep_the_game_when_the_source_throws_on_the_next_stack', () => {
    // The rollback covers the whole state and the phase (classes.md decision 21).
    // The tray takes three stacks at the start, so the fourth draw is the first refill.
    let draws = 0;
    const source = new SeededPieceSource(Seed.of(1), () => {
      draws += 1;
      if (draws > 3) throw new Error('The source failed.');
      return stack('red');
    });
    const game = sortGame(sortState({ board: row(5), source }));
    playMove(game, placeFrom(0, 0));
    playMove(game, placeFrom(1, 2));

    // The third placement empties the tray, and the refill throws.
    expect(() => playMove(game, placeFrom(2, 4))).toThrow('The source failed.');

    const state = game.snapshot();
    expect(game.currentPhase()).toBe(PlayingPhase.instance);
    expect([chipsAt(game, 0), chipsAt(game, 2), chipsAt(game, 4)]).toEqual([['red'], ['red'], []]);
    expect(trayOf(state)).toEqual([[], [], ['red']]);
    expect(state.lastPlacedAt()).toEqual(square(2, 0));
    expect(state.moveCount()).toEqual(Moves.of(2));
    expect(state.goalsReached()).toEqual(ClearedStacks.of(0));
  });
});

// R7: the engine plays a turn on a copy of its state. The Sort state changes in place,
// so a turn that throws after the stack moved and cleared leaves the state of the game.
describe('SortRules atomic turn', () => {
  it('should_keep_the_snapshot_when_the_turn_throws_after_the_stack_changed_the_state', () => {
    const failing: IScoringPolicy<SortState<SquareCoord>> = {
      score: () => {
        throw new Error('The scoring fails.');
      },
    };
    const engine = sortGame(
      sortState({ board: row(2), offered: [stack('red', 'red'), stack('blue')], goalsNeeded: 3 }),
      failing,
    );
    const facts = (state: SortSnapshot<SquareCoord>) => ({
      cells: state.boardCopy().occupiedCells(),
      tray: state.trayStacks(),
      goalsDone: state.goalsReached(),
      clearedTiles: [...state.clearedStackHeights()],
      placedAt: state.lastPlacedAt(),
      score: state.scoreSoFar(),
      moves: state.moveCount(),
    });
    const before = facts(engine.snapshot());

    expect(() => playMove(engine, placeFrom(0, 0, 0))).toThrow('The scoring fails.');
    expect(facts(engine.snapshot())).toEqual(before);
  });
});

// Issue #413: only the template method calls the steps (classes.md decision 21).
// A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
// when the line compiles, because then the directive is unused.
describe('SortRules steps', () => {
  it('should_reject_at_compile_time_when_a_caller_asks_a_step_of_the_sort_rules', () => {
    const rules = new SortRules<SquareCoord>();
    const askSteps = () => [
      // @ts-expect-error The step is protected (issue #413).
      rules.isValid(undefined as never, undefined as never),
      // @ts-expect-error The step is protected (issue #413).
      rules.apply(undefined as never, undefined as never),
      // @ts-expect-error The step is protected (issue #413).
      rules.resolve(undefined as never),
      // @ts-expect-error The step is protected (issue #413).
      rules.evaluate(undefined as never),
    ];

    expect(askSteps).toBeInstanceOf(Function);
  });
});
