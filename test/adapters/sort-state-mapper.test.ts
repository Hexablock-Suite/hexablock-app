/** @jest-environment node */
import { SortStateMapper } from '../../src/adapters/sort-state-mapper';
import { Color } from '../../src/domain/engine/color';
import { ClearedStacks } from '../../src/domain/variants/hexa-sort/cleared-stacks';
import { ColorStack } from '../../src/domain/variants/hexa-sort/color-stack';
import { GoalCount } from '../../src/domain/variants/hexa-sort/goal-count';
import { SortView } from '../../src/domain/variants/hexa-sort/sort-state';

const mapper = new SortStateMapper();

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

  // Issue #353: the payload holds one view for each slot of the tray, in the order of the slots.
  it('should_map_goal_progress_and_each_slot_of_the_tray_when_the_view_has_a_tray', () => {
    const stack = ColorStack.of([Color.of('blue'), Color.of('yellow')]);
    const tray = [stack, undefined, ColorStack.of([Color.of('red')])];

    expect(mapper.toPayload(new SortView(tray, ClearedStacks.of(2), GoalCount.of(4)))).toEqual({
      tray: [{ colors: ['blue', 'yellow'] }, mapper.freeView(), { colors: ['red'] }],
      goalsDone: 2,
      goalsNeeded: 4,
    });
  });

  it('should_keep_goals_and_map_three_empty_slots_when_the_source_has_ended', () => {
    const empty = [undefined, undefined, undefined];

    const payload = mapper.toPayload(new SortView(empty, ClearedStacks.of(0), GoalCount.of(3)));

    expect(payload).toEqual({
      tray: [mapper.freeView(), mapper.freeView(), mapper.freeView()],
      goalsDone: 0,
      goalsNeeded: 3,
    });
  });
});
