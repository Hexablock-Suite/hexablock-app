/** @jest-environment node */
import { SortStateMapper } from '../../src/adapters/sort-state-mapper';
import { Color } from '../../src/domain/engine/color';
import { hex, type HexCoord } from '../../src/domain/engine/hex-topology';
import { Piece } from '../../src/domain/engine/piece';
import { CellNode } from '../../src/domain/engine/shape-node';
import { ClearedStacks } from '../../src/domain/variants/hexa-sort/cleared-stacks';
import { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../src/domain/variants/hexa-sort/goal-count';
import { SortView } from '../../src/domain/variants/hexa-sort/sort-state';

const mapper = new SortStateMapper<HexCoord>();

describe('SortStateMapper', () => {
  it('should_map_the_colors_in_order_with_repeats_when_a_stack_occupies_the_space', () => {
    const colors = [Color.of('red'), Color.of('blue'), Color.of('red')];
    const stack = ColorStack.of(colors);
    colors.pop();

    expect(mapper.toView(stack)).toEqual({ colors: ['red', 'blue', 'red'] });
  });

  it('should_keep_the_stack_unchanged_when_a_receiver_tries_to_change_the_delivered_colors', () => {
    const stack = ColorStack.of([Color.of('red'), Color.of('blue')]);

    stack.deliverTo({
      receive: (colors) => {
        Reflect.set(colors, 0, Color.of('yellow'));
      },
    });

    expect(mapper.toView(stack)).toEqual({ colors: ['red', 'blue'] });
  });

  it('should_map_an_empty_stack_like_a_free_space_when_the_board_keeps_a_cleared_stack', () => {
    expect(mapper.toView(ColorStack.empty())).toEqual(mapper.freeView());
  });

  it('should_map_goal_progress_and_the_current_stack_when_the_view_has_an_offer', () => {
    const stack = ColorStack.of([Color.of('blue'), Color.of('yellow')]);
    const piece = new Piece(new CellNode(hex(0, 0)), stack);

    expect(mapper.toPayload(new SortView(piece, ClearedStacks.of(2), GoalCount.of(4)))).toEqual({
      offered: { colors: ['blue', 'yellow'] },
      goalsDone: 2,
      goalsNeeded: 4,
    });
  });

  it('should_keep_goals_but_map_no_offer_when_the_source_has_ended', () => {
    const payload = mapper.toPayload(new SortView(undefined, ClearedStacks.of(0), GoalCount.of(3)));

    expect(payload).toEqual({ goalsDone: 0, goalsNeeded: 3 });
    expect(payload.offered).toBeUndefined();
  });
});
