/** @jest-environment node */
import { LevelStatus } from '../../src/application/level-summary';

// The status of a level in the list of levels is a closed set of three instances
// (issue #168, S3-12 in #151). It follows the form of `Outcome` (classes.md decision 45).

const statuses = [LevelStatus.completed, LevelStatus.open, LevelStatus.locked];

describe('LevelStatus', () => {
  it('should_equal_only_itself_when_two_statuses_of_the_set_are_compared', () => {
    for (const status of statuses) {
      expect(statuses.map((other) => status.equals(other))).toEqual(
        statuses.map((other) => other === status),
      );
    }
  });

  it('should_throw_a_range_error_when_a_cast_calls_the_constructor', () => {
    const forge = () => Reflect.construct(LevelStatus as unknown as () => void, ['forged']);

    expect(forge).toThrow(new RangeError('The set of level statuses is closed.'));
  });

  it('should_refuse_the_write_when_a_cast_writes_a_field_of_a_status', () => {
    for (const status of statuses) {
      expect(Object.isFrozen(status)).toBe(true);
      expect(Reflect.set(status, 'name', 'forged')).toBe(false);
    }
  });
});
