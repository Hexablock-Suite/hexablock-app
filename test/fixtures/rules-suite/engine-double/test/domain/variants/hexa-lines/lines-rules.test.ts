import type { Clock } from '../../../../src/domain/engine/clock';
import { BaseGameRules, type IGameRules } from '../../../../src/domain/engine/rules';
import { LinesRules } from '../../../../src/domain/variants/hexa-lines/lines-rules';

jest.mock('../../../../src/domain/engine/rules');
jest.mock('@/domain/variants/hexa-lines/lines-rules');
jest.mock('node:fs');

class StubRules extends BaseGameRules<number, number> {
  apply(): number {
    return 0;
  }
}

class HandRules implements IGameRules<number, number> {
  apply(): number {
    return 0;
  }
}

class FakeLines extends LinesRules {}

class FixedClock implements Clock {
  now(): number {
    return 0;
  }
}

function first<TRules extends LinesRules>(rules: TRules[]): TRules | undefined {
  return rules[0];
}

it('should_use_doubles_when_the_suite_replaces_the_rules', () => {
  expect([StubRules, HandRules, FakeLines, FixedClock, first]).toHaveLength(5);
});
