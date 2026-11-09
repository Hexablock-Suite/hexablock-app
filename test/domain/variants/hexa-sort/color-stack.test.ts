/** @jest-environment node */
import { Color } from '../../../../src/domain/engine/color';
import { ColorStack } from '../../../../src/domain/variants/hexa-sort/color-stack';

describe('ColorStack.tileCount()', () => {
  it('should_answer_the_number_of_tiles_when_a_stack_is_asked', () => {
    const red = Color.of('red');

    expect(ColorStack.empty().tileCount()).toBe(0);
    expect(ColorStack.of([red, red, Color.of('blue')]).tileCount()).toBe(3);
    expect('size' in ColorStack.empty()).toBe(false);
  });
});
