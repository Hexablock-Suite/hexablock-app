// The owner of the local progress of the device (D27, issue #46, classes.md decision 66): the last
// signed-in user, or the anonymous owner when no player signed in on the device.
// The owner is not the session: a refused token clears the session, and the owner stays, so the
// player keeps the levels that the device shows as won. Another user who signs in becomes the owner.
// A use case reads the owner once and gives it to each call of the `ProgressRepository` port, so
// the load and the save of one operation use one key.
// It is a value object. `userId` is the id of the account, or `undefined` for the anonymous owner.
// A blank user id throws a `RangeError`, as `Session` does.
export class ProgressOwner {
  // The owner of the progress that the player saves with no account.
  static readonly anonymous = new ProgressOwner(undefined);

  private constructor(readonly userId: string | undefined) {
    Object.freeze(this);
  }

  // The owner of the account `userId`.
  static of(userId: string): ProgressOwner {
    if (userId.trim() === '') throw new RangeError('A progress owner needs a user id.');
    return new ProgressOwner(userId);
  }

  // Two owners are equal when they name one account, or when both are anonymous.
  equals(other: ProgressOwner): boolean {
    return this.userId === other.userId;
  }
}
