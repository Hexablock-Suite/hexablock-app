/** @jest-environment node */
import { LevelId } from '../../../src/domain/engine/level-id';
import { deliveries, RecordingReceiver } from '../../support/engine/value-receiver';

// The id of one level of a game, such as `fit-01` (classes.md decision 42, issue #204).
// The rule of the backend `LevelId` (hexablock-api#88): a text that is not blank.

describe('LevelId', () => {
  it('should_keep_the_text_as_it_arrives_when_the_id_is_not_blank', () => {
    for (const value of ['fit-01', 'l1', ' Level 2 ']) {
      expect(deliveries(LevelId.of(value))).toEqual([value]);
    }
  });

  it('should_throw_a_range_error_when_the_id_is_empty_or_holds_only_spaces', () => {
    for (const value of ['', ' ', '   ', '\t\n']) {
      expect(() => LevelId.of(value)).toThrow(new RangeError('A level id cannot be empty.'));
    }
  });

  it('should_be_equal_in_both_directions_when_two_ids_hold_the_same_text', () => {
    const first = LevelId.of('fit-01');
    const second = LevelId.of('fit-01');

    expect(first).not.toBe(second);
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_ids_hold_different_texts', () => {
    const first = LevelId.of('fit-01');
    const second = LevelId.of('fit-02');

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect(LevelId.of('fit-01').equals(LevelId.of('FIT-01'))).toBe(false);
  });

  // The value leaves the object only through a receiver (issue #228).
  it('should_deliver_its_value_once_and_return_nothing_when_a_receiver_takes_it', () => {
    const receiver = new RecordingReceiver<string>();

    const returned: void = LevelId.of('fit-01').deliverTo(receiver);

    expect(returned).toBeUndefined();
    expect(receiver.received()).toEqual(['fit-01']);
  });

  // A `@ts-expect-error` line is a compile-time test: `pnpm typecheck` fails
  // when the line compiles, because then the directive is unused.
  it('should_reject_at_compile_time_when_a_caller_reads_the_value', () => {
    const readers = [
      // @ts-expect-error `LevelId.value` is private.
      () => LevelId.of('fit-01').value,
    ];

    expect(readers).toHaveLength(1);
  });

  it('should_be_frozen_when_a_caller_tries_to_write_the_value', () => {
    const id = LevelId.of('fit-01');

    expect(Reflect.set(id, 'value', 'fit-02')).toBe(false);
    expect(id.equals(LevelId.of('fit-01'))).toBe(true);
  });
});
