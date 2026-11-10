/** @jest-environment node */
import { Outcome } from '../../../../src/domain/engine/outcome';
import { Score } from '../../../../src/domain/engine/score';
import { GameId } from '../../../../src/domain/engine/game-id';
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { GoalCount } from '../../../../src/domain/variants/hexa-sort/goal-count';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import { startVariant } from '../../../support/engine/variant-game';
import {
  chipsAt,
  names,
  place,
  row,
  sortFactory,
  sortState,
  stack,
  stackPiece,
} from '../../../support/variants/hexa-sort/sort-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';

// The Sort factory creates the whole family of Hexa Sort (issue 99, classes.md decision 31).

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

  it('should_share_the_level_source_and_leave_it_unchanged_when_the_sort_factory_starts_two_games', () => {
    const source = new FixedListPieceSource([stack('red'), stack('blue')].map(stackPiece));
    const factory = new SortFactory(new SquareGeometry(), {
      size: RegionSize.of(2),
      source,
      goalsNeeded: GoalCount.of(1),
    });

    const first = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const second = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);

    expect(names(first.snapshot().offered?.content)).toEqual(['red']);
    expect(names(second.snapshot().offered?.content)).toEqual(['red']);
    // The source is a value: the factory gives the level source itself, and a draw changes nothing.
    expect(factory.createPieceSource() === source).toBe(true);
    expect([...source].map((piece) => names(piece.content))).toEqual([['red'], ['blue']]);
  });
});
