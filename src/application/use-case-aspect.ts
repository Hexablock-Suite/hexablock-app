import { caughtError, FailureCode, Result } from './result';
import type { UseCase } from './use-case';

// The abstract Decorator of the use cases (classes.md decision 9, view 3.1, A2).
// It implements `UseCase` and keeps the inner use case it wraps.
// Each aspect extends it and adds one cross-cutting concern in `around()`.
// The inner use case holds no line of the aspect's code (APP-NFR-11).
// `execute()` never throws to the presenter (decision 28). It turns each exception,
// from the inner use case or from the aspect's own work, into an `unexpected-failure`
// `Result` whose error keeps the exception as its `cause` (G118.1, G118.2).
export abstract class UseCaseAspect<TRequest, TResponse> implements UseCase<TRequest, TResponse> {
  constructor(protected readonly inner: UseCase<TRequest, TResponse>) {}

  async execute(request: TRequest): Promise<Result<TResponse>> {
    try {
      return await this.around(request);
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.unexpectedFailure, thrown));
    }
  }

  // The concern of the aspect. An aspect overrides it and calls `super.around()`
  // to run the inner use case. This base runs the inner use case and returns its
  // `Result` unchanged. A rejected promise gives an `unexpected-failure` `Result`,
  // so the aspect always gets a `Result` back.
  protected async around(request: TRequest): Promise<Result<TResponse>> {
    try {
      return await this.inner.execute(request);
    } catch (thrown) {
      return Result.failure(caughtError(FailureCode.unexpectedFailure, thrown));
    }
  }
}

// Wraps `useCase` in the aspects of `aspects`, from the outside in (issue #323).
// Each entry builds one aspect around the use case that it gets.
// The first entry gives the outer aspect: it sees the call first and the result last.
// An empty list gives `useCase` itself.
export function wrapInAspects<TRequest, TResponse>(
  useCase: UseCase<TRequest, TResponse>,
  aspects: readonly ((inner: UseCase<TRequest, TResponse>) => UseCase<TRequest, TResponse>)[],
): UseCase<TRequest, TResponse> {
  return aspects.reduceRight((inner, aspect) => aspect(inner), useCase);
}
