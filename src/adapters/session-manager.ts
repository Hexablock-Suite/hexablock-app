import { Session } from '../application/session';
import type { SessionStore } from '../application/session-store';
import { isObject, optionalTextIn } from './saved-json';
import type { SecretStore } from './secret-store';

// The key of the session in the secure storage.
const KEY = 'session';
// The version of the saved shape. A new shape gets a new number, so a later app can tell
// an old saved session from a new one.
const VERSION = 1;
const INVALID = 'The kept session is not valid.';
const UNKNOWN_VERSION = 'The kept session has a version that this app does not read.';
const NOT_JSON = 'The kept session is not JSON.';

// The saved session: the version of the shape, the bearer token and the id of the account.
interface SavedSession {
  readonly version: number;
  readonly token: string;
  readonly userId: string;
}

// Adapter of the `SessionStore` port over the secure storage of the device (APP-FR-12,
// classes.md decision 18, #45). It keeps the session as one JSON text under the key `session`
// of a `SecretStore`, so the token never goes to the plain storage of the progress.
// It lives in layer 3, as every adapter of a port does (#437). The driver of layer 4,
// `DeviceSecretStore`, holds the storage package. The composition root builds one manager
// and gives it to `Register`, `Login`, `SyncProgress` and `LocalProgressRepository` (single scope,
// decision 18). `clear()` forgets the session when the backend refuses its token (#46).
// A kept text that is not JSON throws a `SyntaxError` with a fixed message. The message of
// `JSON.parse` can quote the text, and so the token, so the manager does not pass it on.
// A kept session of another version or of the wrong shape throws a `RangeError`, and so does a
// blank token or user id.
export class SessionManager implements SessionStore {
  constructor(private readonly secrets: SecretStore) {}

  async read(): Promise<Session | undefined> {
    const text = await this.secrets.get(KEY);
    if (text === undefined) return undefined;
    return sessionOf(parsed(text));
  }

  async write(session: Session): Promise<void> {
    const saved: SavedSession = { version: VERSION, token: session.token, userId: session.userId };
    await this.secrets.set(KEY, JSON.stringify(saved));
  }

  // Forgets the kept session (#46). `SyncProgress` calls it when the backend refuses the token.
  async clear(): Promise<void> {
    await this.secrets.remove(KEY);
  }
}

// The value of a kept JSON text. A text that is not JSON throws a `SyntaxError` that quotes no
// part of the text.
function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new SyntaxError(NOT_JSON);
  }
}

// The session of a kept JSON value. The constructor of `Session` checks each text.
function sessionOf(data: unknown): Session {
  if (!isObject(data)) throw new RangeError(INVALID);
  if (data.version !== VERSION) throw new RangeError(UNKNOWN_VERSION);
  const token = optionalTextIn(data, 'token', INVALID);
  const userId = optionalTextIn(data, 'userId', INVALID);
  if (token === undefined || userId === undefined) throw new RangeError(INVALID);
  return new Session(token, userId);
}
