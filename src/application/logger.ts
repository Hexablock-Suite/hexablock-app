import { UseCaseError, type Result } from './result';

// The record of one use case call (classes.md decision 37). It is a value object.
// It holds data, never a message: the `Logger` adapter of layer 4 writes the text.
// `error` comes only from a failed `Result`.
// `elapsedMs` has no writer yet. `ConsoleLogger` reads it, and issue #343 gives it its writer.
// `failedDeliveries` comes only from a success that carries failed deliveries (issue #342).
export interface UseCaseLogEntry {
  readonly useCase: string;
  readonly outcome: 'success' | 'failure';
  readonly elapsedMs?: number;
  readonly error?: UseCaseError;
  readonly failedDeliveries?: readonly UseCaseError[];
}

// Output port (classes.md decision 37). `ConsoleLogger` of layer 4 implements it.
export interface Logger {
  log(entry: UseCaseLogEntry): void;
}

// The frozen entry of one call from the name of the use case and its `Result`.
// A success whose value carries failed deliveries gives an entry with a frozen copy of them.
export function logEntryOf(useCase: string, result: Result<unknown>): UseCaseLogEntry {
  if (!result.ok) return Object.freeze({ useCase, outcome: 'failure', error: result.error });
  const failedDeliveries = failedDeliveriesOf(result.value);
  if (failedDeliveries.length === 0) return Object.freeze({ useCase, outcome: 'success' });
  return Object.freeze({ useCase, outcome: 'success', failedDeliveries });
}

// The failed deliveries of the value of a success (issue #342). This function reads the field
// `failedDeliveries` of any value, so the log names no use case and no response type.
// It keeps only the `UseCaseError` items. A value without the field gives an empty list.
function failedDeliveriesOf(value: unknown): readonly UseCaseError[] {
  if (typeof value !== 'object' || value === null || !('failedDeliveries' in value)) return [];
  const { failedDeliveries } = value;
  if (!Array.isArray(failedDeliveries)) return [];
  return Object.freeze(
    failedDeliveries.filter((item): item is UseCaseError => item instanceof UseCaseError),
  );
}
