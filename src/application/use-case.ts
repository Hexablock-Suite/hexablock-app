import type { Result } from './result';

// The generic input port (classes.md decision 9). Every use case implements it,
// so one aspect class can wrap any use case (statement §3.5).
// `execute()` never throws to the presenter: it returns a `Result` (decision 28).
export interface UseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<Result<TResponse>>;
}
