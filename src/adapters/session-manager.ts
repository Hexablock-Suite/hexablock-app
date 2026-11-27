import { Session } from '../application/session';
import type { SessionStore } from '../application/session-store';
import { isObject, optionalTextIn } from './saved-json';
import type { SecretStore } from './secret-store';

// The key of the session in the secure storage.
const KEY = 'session';
// The version of the saved shape. A new shape gets a new number, so a later app can tell
// an old saved session from a new one. Version 1 (#45) always has a token. Version 2 (#46) can keep
// the owner with no token. The manager reads both and writes version 2.
const VERSION = 2;
const FIRST_VERSION = 1;
const INVALID = 'The kept session is not valid.';
const UNKNOWN_VERSION = 'The kept session has a version that this app does not read.';
const NOT_JSON = 'The kept session is not JSON.';

// The saved session: the version of the shape, the id of the account and the bearer token.
// A cleared session has no token: the id of the account stays as the owner of the progress.
interface SavedSession {
  readonly version: number;
  readonly userId: string;
  readonly token?: string;
}

// A kept session: the owner of the progress, and the session when the token is still kept.
interface Kept {
  readonly owner: string;
  readonly session?: Session;
}

// Adapter of the `SessionStore` port over the secure storage of the device (APP-FR-12,
// classes.md decision 18, #45). It keeps the session as one JSON text under the key `session`
// of a `SecretStore`, so the token never goes to the plain storage of the progress.
// It lives in layer 3, as every adapter of a port does (#437). The driver of layer 4,
// `DeviceSecretStore`, holds the storage package. The composition root builds one manager
// and gives it to `Register`, `Login`, `SyncProgress` and `LocalProgressRepository` (single scope,
// decision 18). `clear()` forgets the token when the backend refuses it (#46). It keeps the user id
// as the owner of the local progress (classes.md decision 66), so the player keeps the levels of the
// account. `write()` of another session changes the owner.
// A kept text that is not JSON throws a `SyntaxError` with a fixed message. The message of
// `JSON.parse` can quote the text, and so the token, so the manager does not pass it on.
// A kept session of another version or of the wrong shape throws a `RangeError`, and so does a
// blank token or user id. A session kept by #45 (version 1) still reads.
export class SessionManager implements SessionStore {
  constructor(private readonly secrets: SecretStore) {}

  async read(): Promise<Session | undefined> {
    return (await this.kept())?.session;
  }

  async owner(): Promise<string | undefined> {
    return (await this.kept())?.owner;
  }

  async write(session: Session): Promise<void> {
    const saved: SavedSession = { version: VERSION, userId: session.userId, token: session.token };
    await this.secrets.set(KEY, JSON.stringify(saved));
  }

  // Forgets the token and keeps the owner (#46). `SyncProgress` calls it when the backend refuses
  // the token. A kept text that the manager cannot read holds no owner, so the manager forgets it.
  async clear(): Promise<void> {
    const text = await this.secrets.get(KEY);
    if (text === undefined) return;
    let owner: string;
    try {
      owner = keptOf(parsed(text)).owner;
    } catch {
      await this.secrets.remove(KEY);
      return;
    }
    const saved: SavedSession = { version: VERSION, userId: owner };
    await this.secrets.set(KEY, JSON.stringify(saved));
  }

  // The kept session and its owner, or `undefined` when no player signed in on this device.
  private async kept(): Promise<Kept | undefined> {
    const text = await this.secrets.get(KEY);
    if (text === undefined) return undefined;
    return keptOf(parsed(text));
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

// The owner and the session of a kept JSON value. The constructor of `Session` checks each text.
// Version 1 needs a token. Version 2 has no token after a clear.
function keptOf(data: unknown): Kept {
  if (!isObject(data)) throw new RangeError(INVALID);
  if (data.version !== VERSION && data.version !== FIRST_VERSION) {
    throw new RangeError(UNKNOWN_VERSION);
  }
  const token = optionalTextIn(data, 'token', INVALID);
  const userId = optionalTextIn(data, 'userId', INVALID);
  if (userId === undefined || userId.trim() === '') throw new RangeError(INVALID);
  if (token === undefined) {
    if (data.version === FIRST_VERSION) throw new RangeError(INVALID);
    return { owner: userId };
  }
  return { owner: userId, session: new Session(token, userId) };
}
