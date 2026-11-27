// The error of a call of a transport interface of `src/adapters/api/` (decision 22, #45).
// `status` is the HTTP status of the answer of the backend. It is `undefined` when no answer
// arrived, for example with no network. The message names the call and the status. It never holds
// a body, a header or a token.
export class ApiFailure extends Error {
  constructor(
    readonly status: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}
