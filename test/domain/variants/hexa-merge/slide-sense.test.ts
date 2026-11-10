/** @jest-environment node */
import { SLIDE_SENSES, SlideSense } from '../../../../src/domain/variants/hexa-merge/slide';

// Issue #207 (classes.md decision 45): the sense of a slide is a class with two instances.
describe('SlideSense', () => {
  it('should_hold_exactly_forward_and_backward_when_the_class_is_read', () => {
    const instances = Object.values(SlideSense).filter((value) => value instanceof SlideSense);

    expect(instances).toEqual([SlideSense.forward, SlideSense.backward]);
    expect(SLIDE_SENSES).toEqual([SlideSense.forward, SlideSense.backward]);
    expect(SLIDE_SENSES.map(String)).toEqual(['forward', 'backward']);
    expect(SlideSense.forward).not.toBe(SlideSense.backward);
  });

  it('should_throw_a_range_error_when_a_cast_calls_the_constructor', () => {
    const forge = () => Reflect.construct(SlideSense, ['sideways']);

    expect(forge).toThrow(new RangeError('The set of slide senses is closed.'));
  });

  it('should_refuse_the_write_when_a_cast_writes_a_field_of_a_sense', () => {
    expect(Reflect.set(SlideSense.forward, 'name', 'backward')).toBe(false);
    expect(String(SlideSense.forward)).toBe('forward');
  });

  it('should_be_equal_when_two_senses_have_one_name', () => {
    expect(SlideSense.forward.equals(SlideSense.forward)).toBe(true);
    expect(SlideSense.backward.equals(SlideSense.backward)).toBe(true);
  });

  it('should_not_be_equal_when_two_senses_have_two_names', () => {
    expect(SlideSense.forward.equals(SlideSense.backward)).toBe(false);
    expect(SlideSense.backward.equals(SlideSense.forward)).toBe(false);
  });

  // The leading edge is the edge that the tiles move toward.
  it('should_put_the_last_cell_first_when_a_forward_sense_orders_a_line', () => {
    const line = ['a', 'b', 'c'];

    expect(SlideSense.forward.fromLeadingEdge(line)).toEqual(['c', 'b', 'a']);
    expect(line).toEqual(['a', 'b', 'c']);
  });

  it('should_keep_the_order_in_a_new_list_when_a_backward_sense_orders_a_line', () => {
    const line = ['a', 'b', 'c'];
    const ordered = SlideSense.backward.fromLeadingEdge(line);

    expect(ordered).toEqual(['a', 'b', 'c']);
    expect(ordered).not.toBe(line);
  });
});
