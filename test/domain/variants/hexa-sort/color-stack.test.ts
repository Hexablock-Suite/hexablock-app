/** @jest-environment node */
import { Color } from '../../../../src/domain/engine/color';
import { ColorStack } from '../../../../src/domain/variants/hexa-sort/color-stack';
import { TileCount } from '../../../../src/domain/variants/hexa-sort/tile-count';

describe('ColorStack.tileCount()', () => {
  // The count is a `TileCount` (issue #232).
  it('should_answer_the_number_of_tiles_when_a_stack_is_asked', () => {
    const red = Color.of('red');

    expect(ColorStack.empty().tileCount().equals(TileCount.of(0))).toBe(true);
    expect(
      ColorStack.of([red, red, Color.of('blue')])
        .tileCount()
        .equals(TileCount.of(3)),
    ).toBe(true);
    expect('size' in ColorStack.empty()).toBe(false);
  });
});
