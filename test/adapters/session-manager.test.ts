import { SessionManager } from '../../src/adapters/session-manager';
import { Session } from '../../src/application/ports/session';
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

  // #46: a refused token clears the session, so the next screen asks the player to sign in.
  it('should_give_no_session_to_a_new_manager_when_the_kept_session_is_cleared', async () => {
    const secrets = new InMemorySecretStore();
    await new SessionManager(secrets).write(ADA);

    await new SessionManager(secrets).clear();

    await expect(new SessionManager(secrets).read()).resolves.toBeUndefined();
  });

  // Judgment-day round 1, F3: the progress belongs to the last signed-in user. A refused token
  // clears the token only, so the owner of the progress stays.
  it('should_keep_the_owner_when_the_kept_session_is_cleared', async () => {
    const secrets = new InMemorySecretStore();
    await new SessionManager(secrets).write(ADA);

    await new SessionManager(secrets).clear();

    await expect(new SessionManager(secrets).owner()).resolves.toBe(ADA.userId);
    expect(JSON.parse((await secrets.get('session')) ?? '')).toEqual({
      version: 2,
      userId: ADA.userId,
    });
  });

  it('should_give_no_owner_when_no_player_signed_in', async () => {
    await expect(new SessionManager(new InMemorySecretStore()).owner()).resolves.toBeUndefined();
  });

  it('should_make_the_new_player_the_owner_when_another_player_signs_in_after_a_clear', async () => {
    const sessions = new SessionManager(new InMemorySecretStore());
    await sessions.write(ADA);
    await sessions.clear();

    await sessions.write(GRACE);

    await expect(sessions.owner()).resolves.toBe(GRACE.userId);
    await expect(sessions.read()).resolves.toEqual(GRACE);
  });

  // F3: a session kept by #45 has the version 1. The app still reads it, with its owner.
  it('should_give_the_session_and_its_owner_when_the_kept_session_has_the_version_1', async () => {
    const secrets = new InMemorySecretStore();
    await secrets.set(
      'session',
      JSON.stringify({ version: 1, token: 'token-of-ada', userId: ADA.userId }),
    );

    await expect(new SessionManager(secrets).read()).resolves.toEqual(ADA);
    await expect(new SessionManager(secrets).owner()).resolves.toBe(ADA.userId);
  });

  it('should_keep_no_session_when_a_manager_with_no_session_is_cleared', async () => {
    const sessions = new SessionManager(new InMemorySecretStore());

    await sessions.clear();

    await expect(sessions.read()).resolves.toBeUndefined();
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
      version: 2,
      token: 'token-of-ada',
      userId: '0b6f6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    });
  });

  // V8 quotes the text in the message of a JSON parse error, so the message would hold the token.
  it('should_throw_a_syntax_error_that_quotes_no_part_of_the_text_when_the_kept_session_is_not_json', async () => {
    const secrets = new InMemorySecretStore();
    await secrets.set('session', 'eyJSECRETtoken');

    const thrown = await new SessionManager(secrets).read().then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(thrown).toBeInstanceOf(SyntaxError);
    expect((thrown as SyntaxError).message).not.toContain('eyJSECRETtoken');
    expect((thrown as SyntaxError).message).not.toContain('SECRET');
  });

  it.each([
    ['another version', { version: 3, token: 'a', userId: 'b' }],
    ['no user id', { version: 2, token: 'a' }],
    ['no token', { version: 1, userId: 'b' }],
    ['a blank user id', { version: 1, token: 'a', userId: ' ' }],
    ['a list', [1]],
  ])('should_throw_a_range_error_when_the_kept_session_has_another_shape', async (_case, saved) => {
    const secrets = new InMemorySecretStore();
    await secrets.set('session', JSON.stringify(saved));

    await expect(new SessionManager(secrets).read()).rejects.toThrow(RangeError);
  });
});
