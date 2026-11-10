/** @jest-environment node */
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Score } from '../../../../src/domain/engine/score';
import { GameId } from '../../../../src/domain/engine/game-id';
import { Color } from '../../../../src/domain/engine/color';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import { SortLevel } from '../../../../src/domain/variants/hexa-sort/sort-level';
import { square, type SquareCoord } from '../../../../src/domain/engine/square-topology';
import { startVariant } from '../../../support/engine/variant-game';
import {
  chipsAt,
  names,
  place,
  row,
  sortFactory,
  sortState,
  stack,
} from '../../../support/variants/hexa-sort/sort-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';

// The Sort factory creates the whole family of Hexa Sort (issue 99, classes.md decision 31).

// The offered stack of a new game of `factory`, at the start and after each of two placements.
// The two cells are not neighbors, so no run moves.
function offeredInGame(factory: SortFactory<SquareCoord>): string[][] {
  const { engine } = startVariant(factory);
  const offered = [names(engine.snapshot().offered?.content)];
  for (const move of [place(0, 0), place(1, 1)]) {
    engine.play(move);
    offered.push(names(engine.snapshot().offered?.content));
  }
  return offered;
}

describe('SortFactory', () => {
  it('should_start_the_level_and_place_one_stack_when_the_sort_factory_builds_it', () => {
    const factory = sortFactory([stack('red', 'red'), stack('blue')]);

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { engine, publisher } = startVariant(factory);
    const outcome = engine.play(place(0, 0));

    expect(factory.gameId.equals(GameId.of('hexa-sort'))).toBe(true);
    expect(factory.createBoard(BOARD_ID).shape.cells).toHaveLength(4);
    expect(names(initial.snapshot().offered?.content)).toEqual(['red', 'red']);
    expect(initial.snapshot().goalsNeeded.equals(GoalCount.of(5))).toBe(true);
    expect(outcome).toBe(Outcome.playing);
    expect(chipsAt(engine, 0, 0)).toEqual(['red', 'red']);
    expect(names(engine.snapshot().offered?.content)).toEqual(['blue']);
    expect(engine.snapshot().score).toEqual(Score.of(0));
    expect(publisher.events).toEqual([]);
  });

  it('should_throw_a_range_error_and_build_no_game_when_the_level_goal_is_zero', () => {
    // A goal of 0 once won the game before the first move (sort-rules.ts, `evaluate()`).
    // The level and the state now hold a `GoalCount`, which rejects it (#129).
    const message = 'A goal count needs a whole number of 1 or more, not 0.';

    expect(() => sortFactory([stack('red')], 0)).toThrow(new RangeError(message));
    expect(() => sortState({ board: row(2), offered: [stack('red')], goalsNeeded: 0 })).toThrow(
      new RangeError(message),
    );
  });

  it('should_draw_the_same_stacks_when_two_games_start_from_one_level', () => {
    const levels = [
      SortLevel.fixed(RegionSize.of(2), GoalCount.of(5), [
        stack('red'),
        stack('blue'),
        stack('green'),
        stack('yellow'),
      ]),
      SortLevel.seeded(RegionSize.of(2), GoalCount.of(5), 7, [
        Color.of('red'),
        Color.of('blue'),
        Color.of('green'),
      ]),
    ];

    for (const level of levels) {
      const factory = new SortFactory(new SquareGeometry(), level);
      const first = offeredInGame(factory);
      const second = offeredInGame(factory);
      // A second factory of an equal level draws the same stacks too.
      const third = offeredInGame(new SortFactory(new SquareGeometry(), level));

      expect(first).toHaveLength(3);
      for (const tiles of first) expect(tiles).not.toEqual([]);
      expect(second).toEqual(first);
      expect(third).toEqual(first);
    }
  });

  it('should_keep_the_second_game_at_the_first_stack_when_the_first_game_of_the_level_draws', () => {
    const levels = [
      SortLevel.fixed(RegionSize.of(2), GoalCount.of(5), [
        stack('red'),
        stack('blue'),
        stack('green'),
      ]),
      SortLevel.seeded(RegionSize.of(2), GoalCount.of(5), 7, [
        Color.of('red'),
        Color.of('blue'),
        Color.of('green'),
      ]),
    ];

    for (const level of levels) {
      const factory = new SortFactory(new SquareGeometry(), level);
      const { engine: first } = startVariant(factory);
      const { engine: second } = startVariant(factory);
      const start = names(second.snapshot().offered?.content);
      const sourceAtStart = second.snapshot().source;

      first.play(place(0, 0));
      first.play(place(1, 1));

      expect(names(first.snapshot().offered?.content)).not.toEqual([]);
      expect(names(second.snapshot().offered?.content)).toEqual(start);
      expect(second.snapshot().source).toBe(sourceAtStart);
      expect(names(startVariant(factory).engine.snapshot().offered?.content)).toEqual(start);
    }
  });

  it('should_build_a_new_source_from_the_level_data_when_the_sort_factory_creates_the_piece_source', () => {
    const level = SortLevel.fixed(RegionSize.of(2), GoalCount.of(1), [stack('red'), stack('blue')]);
    const factory = new SortFactory(new SquareGeometry(), level);

    const one = factory.createPieceSource();
    const other = factory.createPieceSource();

    // The level holds no source, so each call builds one, and both give the stacks of the level.
    expect(one).not.toBe(other);
    expect([...one].map((piece) => names(piece.content))).toEqual([['red'], ['blue']]);
    expect([...other].map((piece) => names(piece.content))).toEqual([['red'], ['blue']]);
    // A Sort piece is one cell with a stack: the first cell of the level region.
    expect([...one].map((piece) => piece.shape.cells())).toEqual([[square(0, 0)], [square(0, 0)]]);
  });
});
