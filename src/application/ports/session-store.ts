import type { Session } from './session';

// Output port of the session (APP-FR-12, view 3.4, classes.md decision 18). `Register` and
// `Login` write the session through it, and `SyncProgress` reads it (D27, #46).
// It also keeps the owner of the local progress: the user id of the last signed-in player
// (#46, classes.md decision 66). The owner stays when the session is cleared.
// `SessionManager` of layer 3 implements it over the secure storage of the device.
export interface SessionStore {
  // The kept session, or `undefined` when no player signed in or the session was cleared.
  read(): Promise<Session | undefined>;
  // The user id of the last signed-in player, or `undefined` when no player signed in on this
  // device. A cleared session keeps it.
  owner(): Promise<string | undefined>;
  // Keeps the session in place of the kept one. Its user becomes the owner.
  write(session: Session): Promise<void>;
  // Forgets the token of the kept session and keeps its owner. `SyncProgress` calls it when the
  // backend refuses the token (#46), so the next screen asks the player to sign in, and the player
  // keeps the progress of the account. A store with no session changes nothing.
  clear(): Promise<void>;
}
