import { logEntryOf, type Logger } from './logger';
import type { Result } from './result';
import type { UseCase } from './use-case';
import { UseCaseAspect } from './use-case-aspect';

// Logs each call of the inner use case through the `Logger` port (APP-NFR-11, view 3.1).
// It passes one `UseCaseLogEntry` per call and formats no message (classes.md decision 37).
// It reads no time: `TimingAspect` measures the call with the engine `Clock`.
export class LoggingAspect<TRequest, TResponse> extends UseCaseAspect<TRequest, TResponse> {
  constructor(
    inner: UseCase<TRequest, TResponse>,
    private readonly logger: Logger,
    private readonly name: string,
  ) {
    super(inner);
  }

  override async execute(request: TRequest): Promise<Result<TResponse>> {
    const result = await super.execute(request);
    this.logger.log(logEntryOf(this.name, result));
    return result;
  }
}
