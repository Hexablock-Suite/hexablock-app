/** @jest-environment node */
import { SlideSense } from '../../../../src/domain/variants/hexa-merge/slide';
import { delivered, RecordingReceiver } from '../../../support/engine/value-receiver';

// Issue #207 (classes.md decision 45): the sense of a slide is a class with two instances.
describe('SlideSense', () => {
  it('should_hold_exactly_forward_and_backward_when_the_class_is_read', () => {
    const instances = Object.values(SlideSense).filter((value) => value instanceof SlideSense);

    expect(instances).toEqual([SlideSense.forward, SlideSense.backward]);
    expect(SlideSense.forward).not.toBe(SlideSense.backward);
  });

  // Issue #426: `SlideSense.all` is the one list of the closed set.
  it('should_list_forward_and_backward_once_when_a_caller_reads_the_closed_set', () => {
    expect(SlideSense.all).toEqual([SlideSense.forward, SlideSense.backward]);
    expect(SlideSense.all.map(delivered)).toEqual(['forward', 'backward']);
    expect(Object.isFrozen(SlideSense.all)).toBe(true);
  });

  it('should_throw_a_range_error_when_a_cast_calls_the_constructor', () => {
    const forge = () => Reflect.construct(SlideSense, ['sideways']);

    expect(forge).toThrow(new RangeError('The set of slide senses is closed.'));
  });

  it('should_refuse_the_write_when_a_cast_writes_a_field_of_a_sense', () => {
    expect(Reflect.set(SlideSense.forward, 'name', 'backward')).toBe(false);
    expect(delivered(SlideSense.forward)).toBe('forward');
  });

  // Issue #237: the name leaves a sense only through a receiver (rule R-no-delivery-call).
  it('should_deliver_its_name_once_and_return_nothing_when_a_receiver_takes_it', () => {
    const receiver = new RecordingReceiver<string>();

    const returned: void = SlideSense.backward.deliverTo(receiver);

    expect(returned).toBeUndefined();
    expect(receiver.received()).toEqual(['backward']);
  });

  // Issue #237: no operation returns the name, `toString()` included.
  it('should_give_no_text_when_a_template_literal_or_string_converts_a_sense', () => {
    expect(`${String(SlideSense.forward)}`).toBe('[object Object]');
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
