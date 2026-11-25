/** @jest-environment node */
import { logEntryOf } from '../../src/application/logger';
import { Result, UseCaseError } from '../../src/application/result';
import { ConsoleLogger, type LogSink } from '../../src/infrastructure/console-logger';
import { RecordingLogger } from '../support/application/recording-logger';
import { describeLoggerContract } from '../support/contracts/logger-contract';

// A sink double. It keeps each line that the logger writes, in the order of arrival.
class RecordingSink implements LogSink {
  readonly lines: string[] = [];

  info(text: string): void {
    this.lines.push(text);
  }
}

// Issue #162: the logger driver runs the contract suite of the `Logger` port,
// the same suite as the test fake.
describeLoggerContract('RecordingLogger (test fake)', () => {
  const logger = new RecordingLogger();
  return { logger, written: () => logger.entries.length };
});
describeLoggerContract('ConsoleLogger', () => {
  const sink = new RecordingSink();
  return { logger: new ConsoleLogger(sink), written: () => sink.lines.length };
});

describe('ConsoleLogger', () => {
  // ConsoleLogger writes the text of each entry (classes.md decision 37).
  it('should_write_the_use_case_and_its_outcome_when_a_call_succeeds', () => {
    const sink = new RecordingSink();

    new ConsoleLogger(sink).log(logEntryOf('StartGame', Result.success(1)));

    expect(sink.lines).toEqual(['StartGame: success']);
  });

  it('should_write_the_code_and_the_message_of_the_error_when_a_call_fails', () => {
    const sink = new RecordingSink();
    const error = new UseCaseError('move-rejected', 'The rules rejected the move.');

    new ConsoleLogger(sink).log(logEntryOf('ApplyMove', Result.failure(error)));

    expect(sink.lines).toEqual(['ApplyMove: failure move-rejected (The rules rejected the move.)']);
  });

  it('should_write_the_elapsed_time_last_when_the_entry_holds_it', () => {
    const sink = new RecordingSink();
    const error = new UseCaseError('no-undo', 'The variant has no undo.');

    new ConsoleLogger(sink).log({ useCase: 'UndoMove', outcome: 'failure', elapsedMs: 3, error });

    expect(sink.lines).toEqual(['UndoMove: failure no-undo (The variant has no undo.) in 3 ms']);
  });

  // A success can carry failed deliveries (issue #342). The line shows each one after the outcome.
  it('should_write_each_failed_delivery_after_the_outcome_when_the_entry_holds_failed_deliveries', () => {
    const sink = new RecordingSink();
    const failedDeliveries = [
      new UseCaseError('publish-failed', 'The event bus is down.'),
      new UseCaseError('publish-failed', 'The event bus is still down.'),
    ];

    new ConsoleLogger(sink).log(logEntryOf('ApplyMove', Result.success({ failedDeliveries })));
    new ConsoleLogger(sink).log({
      useCase: 'ApplyMove',
      outcome: 'success',
      elapsedMs: 4,
      failedDeliveries: [failedDeliveries[0]],
    });

    expect(sink.lines).toEqual([
      'ApplyMove: success, failed delivery publish-failed (The event bus is down.)' +
        ', failed delivery publish-failed (The event bus is still down.)',
      'ApplyMove: success, failed delivery publish-failed (The event bus is down.) in 4 ms',
    ]);
  });

  it('should_write_to_the_console_when_no_sink_is_given', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    new ConsoleLogger().log(logEntryOf('StartGame', Result.success(1)));

    expect(info).toHaveBeenCalledWith('StartGame: success');
    info.mockRestore();
  });
});
