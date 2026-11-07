import type { Logger, UseCaseLogEntry } from '../../../src/application/logger';

// A test double of the `Logger` port. It keeps every entry in call order.
export class RecordingLogger implements Logger {
  readonly entries: UseCaseLogEntry[] = [];

  log(entry: UseCaseLogEntry): void {
    this.entries.push(entry);
  }
}
