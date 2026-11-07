import { BaseGameRules } from '../../../src/domain/engine/rules';

// Allowed: an engine test needs a fake subclass of `BaseGameRules` (out of the gate scope).
jest.mock('../../../src/domain/engine/rules');

class FakeRules extends BaseGameRules<number, number> {
  apply(state: number): number {
    return state;
  }
}

it('should_keep_the_state_when_the_fake_rules_apply', () => {
  expect(new FakeRules().apply(1, 2)).toBe(1);
});
