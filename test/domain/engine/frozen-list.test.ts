/** @jest-environment node */
import { frozenListOf } from '../../../src/domain/engine/frozen-list';

// Issue #419: a value object copies each list that it takes and refuses `undefined`.
// One engine function does it, so no value object builds a piece source to copy a list.

describe('frozenListOf', () => {
  it('should_give_a_frozen_copy_of_the_items_in_their_order_when_the_list_holds_no_undefined', () => {
    const items = ['a', 'b', 'c'];

    const copy = frozenListOf(items);
    items.push('d');

    expect(copy).toEqual(['a', 'b', 'c']);
    expect(copy).not.toBe(items);
    expect(Object.isFrozen(copy)).toBe(true);
    expect(frozenListOf<string>([])).toEqual([]);
  });

  it('should_throw_the_range_error_of_a_piece_list_when_the_list_holds_undefined', () => {
    const message = 'A piece list cannot hold undefined.';
    // Only a cast or a sparse list puts `undefined` in a list, as a broken level file would.
    const sparse = ['a'];
    sparse[2] = 'c';

    expect(() => frozenListOf<string | undefined>(['a', undefined])).toThrow(
      new RangeError(message),
    );
    expect(() => frozenListOf(sparse)).toThrow(new RangeError(message));
  });
});
