import type { Session } from './session';

// Output port of the session (APP-FR-12, view 3.4, classes.md decision 18). `Register` and
// `Login` write the session through it, and the sync use cases of #46 read it (D27).
// `SessionManager` of layer 3 implements it over the secure storage of the device.
export interface SessionStore {
  // The kept session, or `undefined` when no player signed in on this device.
  read(): Promise<Session | undefined>;
  // Keeps the session in place of the kept one.
  write(session: Session): Promise<void>;
}
