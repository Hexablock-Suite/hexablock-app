import type { Logger } from '../../../src/application/logger';
import { Result, UseCaseError } from '../../../src/application/result';
import { logEntryOf } from '../../../src/application/logger';

// A logger under test and the count of records that it wrote.
export interface LoggerUnderTest {
  readonly logger: Logger;
  written(): number;
}

// The contract of the `Logger` port (classes.md decision 37, issue #162).
// The test fake and every adapter of the port run the same suite.
// `make()` gives a new logger for each test. Each entry gives one record.
export function describeLoggerContract(name: string, make: () => LoggerUnderTest): void {
  describe(`${name} as a Logger`, () => {
    it('should_write_one_record_when_a_success_is_logged', () => {
      const subject = make();

      subject.logger.log(logEntryOf('StartGame', Result.success(1)));

      expect(subject.written()).toBe(1);
    });

    it('should_write_one_record_when_a_failure_is_logged', () => {
      const subject = make();
      const error = new UseCaseError('move-rejected', 'The rules rejected the move.');

      subject.logger.log(logEntryOf('ApplyMove', Result.failure(error)));

      expect(subject.written()).toBe(1);
    });

    // A success can carry failed deliveries (issue #342). They stay in the record of the call.
    it('should_write_one_record_when_a_success_carries_failed_deliveries', () => {
      const subject = make();
      const failedDeliveries = [
        new UseCaseError('publish-failed', 'The event bus is down.'),
        new UseCaseError('publish-failed', 'The event bus is still down.'),
      ];

      subject.logger.log(logEntryOf('ApplyMove', Result.success({ failedDeliveries })));

      expect(subject.written()).toBe(1);
    });

    it('should_write_one_record_per_entry_when_an_entry_holds_the_elapsed_time', () => {
      const subject = make();

      subject.logger.log({ useCase: 'UndoMove', outcome: 'success', elapsedMs: 12 });
      subject.logger.log(logEntryOf('UndoMove', Result.success(1)));

      expect(subject.written()).toBe(2);
    });
  });
}
