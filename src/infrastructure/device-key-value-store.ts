import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from '../adapters/key-value-store';

// The local storage driver (S3-01 in #151, issue #155). It implements `KeyValueStore`
// of layer 3 with `@react-native-async-storage/async-storage`, which keeps the values on the device.
// So a value survives a restart of the app.
// AsyncStorage gives `null` for a key with no value. This driver gives `undefined`,
// as the interface says. A failure of AsyncStorage rejects the promise, and the caller handles it.
export class DeviceKeyValueStore implements KeyValueStore {
  async get(key: string): Promise<string | undefined> {
    const value = await AsyncStorage.getItem(key);
    return value ?? undefined;
  }

  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }
}
