/** @jest-environment node */
import { MatchId } from '../../src/domain/engine/match-id';
import { SequentialMatchIds } from '../../src/infrastructure/sequential-match-ids';
import { describeMatchIdGeneratorContract } from '../support/contracts/match-id-generator-contract';
import { ManualClock } from '../support/engine/manual-clock';
import { CountingMatchIds } from '../support/engine/match-id';

// Issue #162: the one id generator of the root runs the contract suite of `MatchIdGenerator`,
// the same suite as the test fake.
describeMatchIdGeneratorContract('CountingMatchIds (test fake)', () => new CountingMatchIds());
describeMatchIdGeneratorContract(
  'SequentialMatchIds',
  () => new SequentialMatchIds(new ManualClock()),
);

describe('SequentialMatchIds', () => {
  // Each run of the app starts a new generator, so two runs must not give one id twice.
  it('should_give_other_ids_when_a_second_generator_starts_at_another_time', () => {
    const clock = new ManualClock();
    const first = new SequentialMatchIds(clock);
    clock.advance(1);
    const second = new SequentialMatchIds(clock);

    expect(first.next().equals(second.next())).toBe(false);
  });

  // The clock gives a `ClockReading` since #238. The id keeps the number of the reading.
  it('should_join_the_clock_reading_and_the_count_when_an_id_is_made', () => {
    const clock = new ManualClock();
    const whole = new SequentialMatchIds(clock);
    clock.advance(0.5);
    const fractional = new SequentialMatchIds(clock);

    expect(whole.next().equals(MatchId.of('1000000-1'))).toBe(true);
    expect(whole.next().equals(MatchId.of('1000000-2'))).toBe(true);
    expect(fractional.next().equals(MatchId.of('1000000.5-1'))).toBe(true);
  });
});
