/** @jest-environment node */
import { CoordKey } from '../../../src/domain/engine/coord-key';
import { CoordKeyMap } from '../../../src/domain/engine/coord-key-map';
import { hex, HexTopology } from '../../../src/domain/engine/hex-topology';
import { square, SquareTopology } from '../../../src/domain/engine/square-topology';
import { triangle, TriangleTopology } from '../../../src/domain/engine/triangle-topology';
import { delivered } from '../../support/engine/value-receiver';

// Issue #246: a branded key counts as a primitive (decision of 2026-11-16, option A).
// So `CoordKey` is a value object of the engine. It compares by value with `equals()`,
// and `CoordKeyMap` finds a value by an equal key, not by the same object.
describe('CoordKey', () => {
  it('should_be_equal_when_two_keys_hold_the_same_text', () => {
    const first = CoordKey.of('1,2');
    const second = CoordKey.of('1,2');

    expect(first).not.toBe(second);
    expect(first.equals(second)).toBe(true);
    expect(first.equals(CoordKey.of('2,1'))).toBe(false);
  });

  it('should_give_equal_keys_when_two_coordinates_are_equal', () => {
    const topologies = [
      [new HexTopology().key(hex(1, -2)), new HexTopology().key(hex(1, -2))],
      [new SquareTopology().key(square(1, -2)), new SquareTopology().key(square(1, -2))],
      [new TriangleTopology().key(triangle(1, -2)), new TriangleTopology().key(triangle(1, -2))],
    ] as const;

    for (const [first, second] of topologies) {
      expect(first).not.toBe(second);
      expect(first.equals(second)).toBe(true);
    }
    expect(hex(1, -2).key().equals(hex(-2, 1).key())).toBe(false);
  });

  it('should_order_the_keys_by_plain_text_order_when_two_keys_are_compared', () => {
    expect(CoordKey.of('-1,0').isBefore(CoordKey.of('0,0'))).toBe(true);
    expect(CoordKey.of('0,0').isBefore(CoordKey.of('-1,0'))).toBe(false);
    expect(CoordKey.of('0,0').isBefore(CoordKey.of('0,0'))).toBe(false);
    expect(CoordKey.of('1,10').isBefore(CoordKey.of('1,2'))).toBe(true);
  });

  it('should_deliver_the_text_when_a_receiver_of_the_edge_asks', () => {
    expect(delivered(hex(-0, 3).key())).toBe('0,3');
    expect(delivered(square(1, -2).key())).toBe('1,-2');
    expect(delivered(triangle(1, -2).key())).toBe('1,-2');
  });

  it('should_tell_two_lists_alike_when_they_hold_equal_keys_in_any_order', () => {
    const keys = (...texts: string[]) => texts.map((text) => CoordKey.of(text));

    expect(CoordKey.sameKeys(keys('0,0', '1,0', '1,0'), keys('1,0', '0,0', '1,0'))).toBe(true);
    expect(CoordKey.sameKeys(keys('0,0', '1,0'), keys('0,0', '1,0', '1,0'))).toBe(false);
    expect(CoordKey.sameKeys(keys('0,0', '0,0', '1,0'), keys('0,0', '1,0', '1,0'))).toBe(false);
    expect(CoordKey.sameKeys([], [])).toBe(true);
  });
});

describe('CoordKeyMap', () => {
  it('should_find_the_value_when_the_key_is_equal_but_not_the_same_object', () => {
    const map = new CoordKeyMap<string>();
    map.set(CoordKey.of('1,2'), 'red');

    expect(map.has(CoordKey.of('1,2'))).toBe(true);
    expect(map.find(CoordKey.of('1,2'))).toBe('red');
    expect(map.has(CoordKey.of('2,1'))).toBe(false);
    expect(map.find(CoordKey.of('2,1'))).toBeUndefined();
  });

  it('should_keep_the_place_of_a_key_when_an_equal_key_is_set_again', () => {
    const map = new CoordKeyMap<string>();
    map.set(CoordKey.of('0,0'), 'red');
    map.set(CoordKey.of('1,0'), 'blue');
    map.set(CoordKey.of('0,0'), 'green');

    expect(map.values()).toEqual(['green', 'blue']);
    expect(map.entries().map(([key, value]) => [delivered(key), value])).toEqual([
      ['0,0', 'green'],
      ['1,0', 'blue'],
    ]);
  });

  it('should_remove_the_value_when_an_equal_key_is_deleted', () => {
    const map = new CoordKeyMap<string>();
    map.set(CoordKey.of('0,0'), 'red');
    map.set(CoordKey.of('1,0'), 'blue');

    map.delete(CoordKey.of('0,0'));
    map.delete(CoordKey.of('5,5'));
    map.set(CoordKey.of('0,0'), 'red');

    expect(map.values()).toEqual(['blue', 'red']);
  });

  it('should_give_a_new_list_when_the_values_are_asked', () => {
    const map = new CoordKeyMap<string>();
    map.set(CoordKey.of('0,0'), 'red');

    map.values().push('blue');
    map.entries().pop();

    expect(map.values()).toEqual(['red']);
  });
});
