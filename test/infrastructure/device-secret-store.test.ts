import * as SecureStore from 'expo-secure-store';

import { DeviceSecretStore } from '../../src/infrastructure/device-secret-store';
import { InMemorySecretStore } from '../support/adapters/in-memory-secret-store';
import { describeSecretStoreContract } from '../support/contracts/secret-store-contract';

// The native module of expo-secure-store is missing under Jest, and jest-expo gives functions
// that keep nothing. This mock keeps the values in memory, as the device does. The package code
// above the native module still runs, so it still checks each key.
const mockValues = new Map<string, string>();
jest.mock('expo-secure-store/build/ExpoSecureStore', () => ({
  __esModule: true,
  default: {
    getValueWithKeyAsync: (key: string) => Promise.resolve(mockValues.get(key) ?? null),
    setValueWithKeyAsync: (value: string, key: string) => {
      mockValues.set(key, value);
      return Promise.resolve();
    },
    deleteValueWithKeyAsync: (key: string) => {
      mockValues.delete(key);
      return Promise.resolve();
    },
  },
}));

// Each test starts with an empty secure storage, so `make()` gives an empty store.
beforeEach(() => {
  mockValues.clear();
});

describeSecretStoreContract('InMemorySecretStore (test fake)', () => new InMemorySecretStore());
describeSecretStoreContract('DeviceSecretStore', () => new DeviceSecretStore());

describe('DeviceSecretStore', () => {
  it('should_keep_the_value_in_the_secure_storage_of_the_device_when_a_value_is_kept', async () => {
    await new DeviceSecretStore().set('session', '{"token":"a"}');

    await expect(SecureStore.getItemAsync('session')).resolves.toBe('{"token":"a"}');
  });

  it('should_reject_with_the_error_of_the_secure_storage_when_a_key_holds_another_character', async () => {
    await expect(new DeviceSecretStore().set('progress:hexa-fit', 'a')).rejects.toThrow(
      'Invalid key provided to SecureStore.',
    );
  });
});
