import { SessionManager } from '../../src/adapters/session-manager';
import { Session } from '../../src/application/session';
import { InMemorySecretStore } from '../support/adapters/in-memory-secret-store';

// #45 (APP-FR-12): `SessionManager` keeps the session of the signed-in player in the secure
// storage of the device, so the session survives a restart of the app.

const ADA = new Session('token-of-ada', '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
const GRACE = new Session('token-of-grace', '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f');

describe('SessionManager', () => {
  it('should_give_no_session_when_no_player_signed_in', async () => {
    await expect(new SessionManager(new InMemorySecretStore()).read()).resolves.toBeUndefined();
  });

  it('should_give_back_the_session_to_a_new_manager_when_a_session_is_written', async () => {
    const secrets = new InMemorySecretStore();

    await new SessionManager(secrets).write(ADA);

    await expect(new SessionManager(secrets).read()).resolves.toEqual(ADA);
  });

  it('should_give_back_the_last_session_when_a_second_session_replaces_the_first', async () => {
    const sessions = new SessionManager(new InMemorySecretStore());

    await sessions.write(ADA);
    await sessions.write(GRACE);

    await expect(sessions.read()).resolves.toEqual(GRACE);
  });

  // The saved format: one versioned JSON text under the key `session`.
  it('should_keep_the_session_as_versioned_json_under_the_key_session_when_a_session_is_written', async () => {
    const secrets = new InMemorySecretStore();

    await new SessionManager(secrets).write(ADA);

    expect(JSON.parse((await secrets.get('session')) ?? '')).toEqual({
      version: 1,
      token: 'token-of-ada',
      userId: '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    });
  });

  it.each([
    ['another version', { version: 2, token: 'a', userId: 'b' }],
    ['no token', { version: 1, userId: 'b' }],
    ['a blank user id', { version: 1, token: 'a', userId: ' ' }],
    ['a list', [1]],
  ])('should_throw_a_range_error_when_the_kept_session_has_another_shape', async (_case, saved) => {
    const secrets = new InMemorySecretStore();
    await secrets.set('session', JSON.stringify(saved));

    await expect(new SessionManager(secrets).read()).rejects.toThrow(RangeError);
  });
});
