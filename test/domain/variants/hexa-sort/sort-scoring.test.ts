/** @jest-environment node */
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Score } from '../../../../src/domain/engine/score';
import { ClearedStacks } from '../../../../src/domain/variants/hexa-sort/cleared-stacks';
import { square } from '../../../support/engine/square-topology';
import {
  place,
  row,
  sortGame,
  sortState,
  stack,
  tiles,
} from '../../../support/variants/hexa-sort/sort-game';
import {
  SORT_POINTS_PER_TILE,
  SortScoring,
} from '../../../../src/domain/variants/hexa-sort/sort-scoring';
import type { SquareCoord } from '../../../support/engine/square-topology';

// The Sort scoring of issue #98. It codes the accepted rule of issue #59 (D22):
// 10 points per tile of a cleared stack. The Sort stars have their own suite.
// Every test drives the game through `GameEngine.play()`, so the engine adds the points.

describe('SortScoring', () => {
  it('should_score_ten_points_per_tile_of_the_cleared_stack_when_the_turn_clears_a_stack', () => {
    // The left stack holds one blue below nine reds. The placed red makes a top run of ten,
    // so the whole stack of eleven tiles clears.
    const game = sortGame(
      sortState({
        board: row(2, [[square(0, 0), stack('blue', ...tiles('red', 9))]]),
        offered: [stack('green', 'red'), stack('blue')],
      }),
      new SortScoring<SquareCoord>(),
    );

    expect(game.play(place(1))).toBe(Outcome.playing);

    expect(SORT_POINTS_PER_TILE).toBe(10);
    expect(game.snapshot().goalsDone).toEqual(ClearedStacks.of(1));
    expect(game.snapshot().score).toEqual(Score.of(110));
  });

  it('should_score_no_points_and_keep_the_score_when_the_turn_clears_no_stack', () => {
    const game = sortGame(
      sortState({
        board: row(3, [[square(0, 0), stack('blue', ...tiles('red', 9))]]),
        offered: [stack('green', 'red'), stack('yellow'), stack('blue')],
      }),
      new SortScoring<SquareCoord>(),
    );
    game.play(place(1));

    expect(game.play(place(2))).toBe(Outcome.playing);

    expect(game.snapshot().goalsDone).toEqual(ClearedStacks.of(1));
    expect(game.snapshot().score).toEqual(Score.of(110));
  });
});
