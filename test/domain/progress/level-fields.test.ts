/** @jest-environment node */
import { fieldsOf } from '../../../src/domain/progress/level-fields';

// The fields of one JSON object of a level file (issue #424, DS-6). `FitLevelBuilder` and
// `SortLevelBuilder` read each object of a section through this one function.
// A refused value goes into the error as its `cause` (issue #237).

const MESSAGE = 'A star of a test level needs a move count.';
const refusal = (cause: unknown) => new RangeError(MESSAGE, { cause });

describe('fieldsOf', () => {
  it('should_give_the_fields_of_the_object_when_it_holds_every_named_field', () => {
    const value = { maxMoves: 10, maxElapsedMs: 0, extra: 'kept' };

    const { maxMoves, maxElapsedMs } = fieldsOf(value, ['maxMoves', 'maxElapsedMs'], refusal);

    expect([maxMoves, maxElapsedMs]).toEqual([10, 0]);
  });

  it('should_give_the_fields_when_no_field_is_named_and_the_value_is_an_object', () => {
    const fields = fieldsOf<'seed'>({}, [], refusal);

    expect(fields.seed).toBeUndefined();
  });

  it('should_throw_the_refusal_with_the_value_as_cause_when_a_named_field_is_missing', () => {
    const value = { maxElapsedMs: 0 };

    expect(() => fieldsOf(value, ['maxMoves'], refusal)).toThrow(
      new RangeError(MESSAGE, { cause: value }),
    );
  });

  it('should_throw_the_refusal_with_the_value_as_cause_when_the_value_is_no_json_object', () => {
    for (const value of [null, undefined, 3, 'text', [], [{ maxMoves: 1 }]]) {
      let caught: unknown;
      try {
        fieldsOf(value, [], refusal);
      } catch (error) {
        caught = error;
      }

      expect(caught).toEqual(new RangeError(MESSAGE));
      expect((caught as Error).cause).toBe(value);
    }
  });
});
