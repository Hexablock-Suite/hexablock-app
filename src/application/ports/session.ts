// The session of a signed-in player (APP-FR-12, view 3.4). It is a value object.
// `token` is the bearer token that the backend gave at sign-in. A request that needs an account
// sends it (D27). `userId` is the id of the account of the token.
// A blank token or a blank user id throws a `RangeError`, because no request can use it.
export class Session {
  constructor(
    readonly token: string,
    readonly userId: string,
  ) {
    if (token.trim() === '') throw new RangeError('A session needs a token.');
    if (userId.trim() === '') throw new RangeError('A session needs a user id.');
    Object.freeze(this);
  }
}
