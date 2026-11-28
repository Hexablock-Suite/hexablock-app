import { logEntryOf, type Logger } from './logger';
import type { Clock } from '../../domain/engine/turn/clock';
import type { Result } from '../result';
import type { UseCase } from '../use-case';
import { UseCaseAspect } from './use-case-aspect';

// Logs each call of the inner use case through the `Logger` port (APP-NFR-11, view 3.1).
// It passes one `UseCaseLogEntry` per call and formats no message (classes.md decision 37).
// It is the only writer of the log for a use case. `logEntryOf()` copies the failed deliveries of a success
// into that one entry, so this class names no use case and no response type (issue #342).
// It reads the engine `Clock` before and after the inner call (issue #343).
// The one entry of the call carries the time between the two readings, for a success and for a failure.
// It reads time only through `Clock`. With no clock, the entry has no duration.
// An empty or blank `name` throws a `RangeError`, because the log names the call by it (G118.4).
// The log comes after the inner call, so the use case already did its work.
// A logger or a clock that throws after the call does not change the result: `execute()` returns the inner `Result`.
// The aspect drops that failure. The `Logger` adapter reports a failure of its own (classes.md decision 28).
export class LoggingAspect<TRequest, TResponse> extends UseCaseAspect<TRequest, TResponse> {
  constructor(
    inner: UseCase<TRequest, TResponse>,
    private readonly logger: Logger,
    private readonly name: string,
    private readonly clock?: Clock,
  ) {
    super(inner);
    if (name.trim() === '') throw new RangeError('A logging aspect needs a name.');
  }

  protected override async around(request: TRequest): Promise<Result<TResponse>> {
    const started = this.clock?.now();
    const result = await super.around(request);
    try {
      const elapsedMs = started === undefined ? undefined : this.clock?.now().elapsedSince(started);
      this.logger.log(logEntryOf(this.name, result, elapsedMs));
    } catch {
      // The use case already ran. A failed log entry does not rewrite its result.
    }
    return result;
  }
}
