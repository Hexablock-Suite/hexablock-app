import { logEntryOf, type Logger } from './logger';
import type { Result } from './result';
import type { UseCase } from './use-case';
import { UseCaseAspect } from './use-case-aspect';

// Logs each call of the inner use case through the `Logger` port (APP-NFR-11, view 3.1).
// It passes one `UseCaseLogEntry` per call and formats no message (classes.md decision 37).
// It reads no time: `TimingAspect` measures the call with the engine `Clock`.
// An empty or blank `name` throws a `RangeError`, because the log names the call by it (G118.4).
// A logger that throws gives an `unexpected-failure` `Result` from `execute()`.
export class LoggingAspect<TRequest, TResponse> extends UseCaseAspect<TRequest, TResponse> {
  constructor(
    inner: UseCase<TRequest, TResponse>,
    private readonly logger: Logger,
    private readonly name: string,
  ) {
    super(inner);
    if (name.trim() === '') throw new RangeError('A logging aspect needs a name.');
  }

  protected override async around(request: TRequest): Promise<Result<TResponse>> {
    const result = await super.around(request);
    this.logger.log(logEntryOf(this.name, result));
    return result;
  }
}
