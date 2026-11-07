/** @jest-environment node */
import { Board } from '../../../../src/domain/engine/board';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import type { RandomSource } from '../../../../src/domain/engine/random-source';
import { SeededPieceSource } from '../../../../src/domain/engine/piece-source';
import { BaseGameRules } from '../../../../src/domain/engine/rules';
import type { ColorStack } from '../../../../src/domain/variants/hexa-sort/color-stack';
import { SortRules } from '../../../../src/domain/variants/hexa-sort/sort-rules';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import {
  chipsAt,
  place,
  row,
  sortGame,
  sortState,
  stack,
  stackPiece,
  tiles,
} from '../../../support/variants/hexa-sort/sort-game';

// The rules of issue #93 and the proposal of issue #56 («Propuesta, pendiente del equipo»).
// Every test drives the game through `GameEngine.play()`, so it uses only the rules contract.

describe('SortRules contract', () => {
  it('should_extend_the_base_rules_when_the_variant_implements_the_contract', () => {
    expect(new SortRules()).toBeInstanceOf(BaseGameRules);
  });
});

describe('SortRules placement', () => {
  it('should_put_the_offered_stack_on_the_cell_and_offer_the_next_when_the_cell_is_empty', () => {
    const game = sortGame(sortState({ board: row(3), offered: [stack('red'), stack('blue')] }));

    expect(game.play(place(0))).toBe('playing');

    expect(chipsAt(game, 0)).toEqual(['red']);
    expect(game.snapshot().offered?.content.chips).toEqual(['blue']);
  });

  it('should_reject_the_move_and_keep_the_state_when_the_cell_holds_a_stack', () => {
    const game = sortGame(
      sortState({ board: row(3, [[square(0, 0), stack('green')]]), offered: [stack('red')] }),
    );

    expect(game.play(place(0))).toBe('playing');

    expect(chipsAt(game, 0)).toEqual(['green']);
    expect(game.snapshot().offered?.content.chips).toEqual(['red']);
  });

  it('should_reject_the_move_when_the_cell_is_outside_the_board', () => {
    const game = sortGame(sortState({ board: row(2), offered: [stack('red')] }));

    expect(game.play(place(5))).toBe('playing');

    expect(game.snapshot().board.cells()).toEqual([]);
    expect(game.snapshot().offered?.content.chips).toEqual(['red']);
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

    game.play(place(1));

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

    game.play(place(1));

    expect(chipsAt(game, 0)).toEqual(['blue', 'red', 'red', 'red']);
    expect(chipsAt(game, 1)).toEqual(['green']);
  });

  it('should_move_to_the_first_stack_in_board_order_when_two_stacks_tie', () => {
    // The board holds (2, 0) before (0, 0), so (2, 0) comes first in `board.cells()`.
    const game = sortGame(
      sortState({
        board: row(3, [
          [square(2, 0), stack('red', 'red')],
          [square(0, 0), stack('red', 'red')],
        ]),
        offered: [stack('red')],
      }),
    );

    game.play(place(1));

    expect(chipsAt(game, 2)).toEqual(['red', 'red', 'red']);
    expect(chipsAt(game, 0)).toEqual(['red', 'red']);
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

    game.play(place(2));

    expect(chipsAt(game, 2)).toEqual(['red', 'red', 'red']);
    expect(chipsAt(game, 1)).toEqual([]);
    expect(chipsAt(game, 0)).toEqual(['blue', 'blue', 'blue']);
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

    expect(game.play(place(1))).toBe('playing');

    const state = game.snapshot();
    expect(chipsAt(game, 0)).toEqual([]);
    expect(chipsAt(game, 1)).toEqual([]);
    expect(state.goalsDone).toBe(1);
    expect(state.clearedTiles).toEqual([11]);
  });

  it('should_keep_the_stack_when_its_top_run_is_nine', () => {
    const game = sortGame(
      sortState({
        board: row(2, [[square(0, 0), stack(...tiles('red', 6))]]),
        offered: [stack(...tiles('red', 3)), stack('blue')],
      }),
    );

    game.play(place(1));

    expect(chipsAt(game, 0)).toEqual(tiles('red', 9));
    expect(game.snapshot().goalsDone).toBe(0);
    expect(game.snapshot().clearedTiles).toEqual([]);
  });

  it('should_forget_the_cleared_stacks_of_the_last_turn_when_a_new_turn_starts', () => {
    const game = sortGame(
      sortState({
        board: row(3, [[square(0, 0), stack(...tiles('red', 6))]]),
        offered: [stack(...tiles('red', 4)), stack('blue'), stack('green')],
      }),
    );

    game.play(place(1));
    game.play(place(2));

    expect(game.snapshot().goalsDone).toBe(1);
    expect(game.snapshot().clearedTiles).toEqual([]);
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

    expect(game.play(place(1))).toBe('victory');
  });

  it('should_lose_when_the_board_is_full', () => {
    const game = sortGame(
      sortState({ board: row(2), offered: [stack('red'), stack('blue'), stack('green')] }),
    );

    expect(game.play(place(0))).toBe('playing');
    expect(game.play(place(1))).toBe('game-over');
  });

  it('should_lose_when_the_fixed_list_has_no_stack_left', () => {
    const game = sortGame(sortState({ board: row(3), offered: [stack('red')] }));

    expect(game.play(place(0))).toBe('game-over');
    expect(game.snapshot().offered).toBeUndefined();
  });
});

describe('SortRules piece source (A4)', () => {
  it('should_offer_the_same_stacks_when_two_games_use_the_same_seed', () => {
    const colors = ['red', 'blue', 'green'];
    const draw = (random: RandomSource) =>
      stackPiece(stack(colors[Math.floor(random.next() * colors.length)] ?? 'red'));
    const play = () => {
      const game = sortGame(sortState({ board: row(4), source: new SeededPieceSource(7, draw) }));
      game.play(place(0));
      game.play(place(3));
      return [chipsAt(game, 0), chipsAt(game, 3)];
    };

    const first = play();

    expect(first[0]).toHaveLength(1);
    expect(first[1]).toHaveLength(1);
    expect(play()).toEqual(first);
  });
});

// Edge cases of the walkthrough of PR #108 (issue #120).
describe('SortRules edge cases', () => {
  // A 3 × 3 square board with the given stacks, in the order of the list.
  function grid(
    content: readonly [SquareCoord, ColorStack][],
  ): Board<ColorStack, SquareCoord, string> {
    const board = new Board<ColorStack, SquareCoord, string>(
      squareTopology.region(RegionSize.of(3)),
      squareTopology,
    );
    for (const [at, cell] of content) board.set(at, cell);
    return board;
  }

  it('should_break_the_tie_by_the_old_place_of_a_cleared_cell_when_a_stack_is_placed_on_it', () => {
    // A tie goes to the first stack in `board.cells()` order (proposal of issue #56).
    // A cleared cell keeps an empty stack (sort-state.ts), so it keeps its place in that order.
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
    game.play(place(2));
    expect(game.snapshot().goalsDone).toBe(1);
    expect(chipsAt(game, 1)).toEqual([]);

    // The placed red ties with the red on (0, 0). The cell (1, 0) comes first in the board order.
    game.play(place(1));

    expect(chipsAt(game, 1)).toEqual(['red', 'red']);
    expect(chipsAt(game, 0)).toEqual(['blue']);
    expect(chipsAt(game, 2)).toEqual([]);
  });

  it('should_clear_the_placed_stack_and_count_a_goal_when_its_top_run_already_holds_ten_or_more', () => {
    // A top run of 10 or more removes the whole stack and counts one goal (proposal of issue #56).
    // The cascade starts at the placed stack (sort-rules.ts), so no neighbor is needed.
    const game = sortGame(
      sortState({
        board: row(3),
        offered: [stack('blue', ...tiles('red', 12)), stack('green')],
        goalsNeeded: 2,
      }),
    );

    const outcome = game.play(place(1));

    const state = game.snapshot();
    expect(outcome).toBe('playing');
    expect(chipsAt(game, 1)).toEqual([]);
    expect(state.goalsDone).toBe(1);
    expect(state.clearedTiles).toEqual([13]);
    expect(state.offered?.content.chips).toEqual(['green']);
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

    game.play(place(1, 1));

    expect(chipsAt(game, 1, 1)).toEqual(tiles('red', 6));
    for (const at of ring) expect(chipsAt(game, at.col, at.row)).toEqual(['blue']);
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

    game.play(place(1, 1));

    expect(chipsAt(game, 1, 0)).toEqual(tiles('red', 5));
    expect(chipsAt(game, 1, 1)).toEqual([]);
    for (const at of others) expect(chipsAt(game, at.col, at.row)).toEqual(['blue', 'red']);
  });

  it('should_throw_and_keep_the_game_when_the_source_throws_on_the_next_stack', () => {
    // The rollback covers the whole state and the phase (classes.md decision 21).
    let draws = 0;
    const source = new SeededPieceSource(1, () => {
      draws += 1;
      if (draws > 1) throw new Error('The source failed.');
      return stackPiece(stack('red'));
    });
    const game = sortGame(sortState({ board: row(3), source }));

    expect(() => game.play(place(0))).toThrow('The source failed.');

    const state = game.snapshot();
    expect(game.phase.name).toBe('playing');
    expect(state.board.cells()).toEqual([]);
    expect(state.offered?.content.chips).toEqual(['red']);
    expect(state.placedAt).toBeUndefined();
    expect(state.goalsDone).toBe(0);
  });
});
