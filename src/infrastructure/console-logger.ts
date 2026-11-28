import { valueOf } from '../adapters/delivered';
import type { Logger, UseCaseLogEntry } from '../application/aspects/logger';

// Where the logger writes its text. The global `console` fits it.
export interface LogSink {
  info(text: string): void;
}

// The logger driver (classes.md decision 37, issue #162). It implements the `Logger` port
// and writes one line of text for each entry. The aspects pass data, never a message,
// so this class is the only place that formats the text.
// The line: `<use case>: <outcome>`, then ` <code> (<message>)` for an error,
// then `, failed delivery <code> (<message>)` for each failed delivery (issue #342),
// then ` in <n> ms`, the duration of a measured call (issue #343). For example `ApplyMove: failure move-rejected (...)`
// or `ApplyMove: success, failed delivery publish-failed (...)`.
// A rejected move is a normal part of a game, so every line goes to `info()`.
export class ConsoleLogger implements Logger {
  constructor(private readonly sink: LogSink = console) {}

  log(entry: UseCaseLogEntry): void {
    const error = entry.error === undefined ? '' : ` ${entry.error.code} (${entry.error.message})`;
    const deliveries = (entry.failedDeliveries ?? [])
      .map((failed) => `, failed delivery ${failed.code} (${failed.message})`)
      .join('');
    const time = entry.elapsedMs === undefined ? '' : ` in ${valueOf(entry.elapsedMs)} ms`;
    this.sink.info(`${entry.useCase}: ${entry.outcome}${error}${deliveries}${time}`);
  }
}
