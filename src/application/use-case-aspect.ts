import type { Result } from './result';
import type { UseCase } from './use-case';

// The abstract Decorator of the use cases (classes.md decision 9, view 3.1, A2).
// It implements `UseCase` and keeps the inner use case it wraps.
// Its `execute()` runs the inner use case and returns its `Result` unchanged.
// Each aspect extends it and adds one cross-cutting concern around `super.execute()`.
// The inner use case holds no line of the aspect's code (APP-NFR-11).
export abstract class UseCaseAspect<TRequest, TResponse> implements UseCase<TRequest, TResponse> {
  constructor(protected readonly inner: UseCase<TRequest, TResponse>) {}

  execute(request: TRequest): Promise<Result<TResponse>> {
    return this.inner.execute(request);
  }
}
