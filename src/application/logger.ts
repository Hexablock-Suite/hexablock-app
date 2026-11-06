import type { Result, UseCaseError } from './result';

// The record of one use case call (classes.md decision 37). It is a value object.
// It holds data, never a message: the `Logger` adapter of layer 4 writes the text.
// `elapsedMs` comes only from `TimingAspect`, and `error` only from a failed `Result`.
export interface UseCaseLogEntry {
  readonly useCase: string;
  readonly outcome: 'success' | 'failure';
  readonly elapsedMs?: number;
  readonly error?: UseCaseError;
}

// Output port (classes.md decision 37). `ConsoleLogger` of layer 4 implements it.
export interface Logger {
  log(entry: UseCaseLogEntry): void;
}

// The frozen entry of one call from the name of the use case and its `Result`.
export function logEntryOf(useCase: string, result: Result<unknown>): UseCaseLogEntry {
  if (result.ok) return Object.freeze({ useCase, outcome: 'success' });
  return Object.freeze({ useCase, outcome: 'failure', error: result.error });
}
