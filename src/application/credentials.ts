// The request of `Register` and `Login` (APP-FR-12, view 3.4): the username and the password
// that the player types. It is plain data. The backend checks both values, so the use cases
// check nothing.
export interface Credentials {
  readonly username: string;
  readonly password: string;
}
