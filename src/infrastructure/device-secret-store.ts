import * as SecureStore from 'expo-secure-store';

import type { SecretStore } from '../adapters/secret-store';

// The secure storage driver (APP-FR-12, issue #45). It implements `SecretStore` of layer 3 with
// `expo-secure-store`, which keeps each value in the Keychain of iOS or encrypted with the Keystore
// of Android. So the session survives a restart of the app, and other apps cannot read the token.
// `expo-secure-store` gives `null` for a key with no value. This driver gives `undefined`, as
// the interface says. A key with a character other than a letter, a digit, `.`, `-` or `_` and
// a failure of the storage reject the promise, and the caller handles it.
// The web build of the team has no native secure storage, so there each call rejects.
export class DeviceSecretStore implements SecretStore {
  async get(key: string): Promise<string | undefined> {
    const value = await SecureStore.getItemAsync(key);
    return value ?? undefined;
  }

  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }

  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }
}
