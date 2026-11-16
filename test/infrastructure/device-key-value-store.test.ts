import AsyncStorage from '@react-native-async-storage/async-storage';

import { DeviceKeyValueStore } from '../../src/infrastructure/device-key-value-store';
import { InMemoryKeyValueStore } from '../support/adapters/in-memory-key-value-store';
import { describeKeyValueStoreContract } from '../support/contracts/key-value-store-contract';

// AsyncStorage needs its native module, and Jest runs no device.
// The package ships this official mock. It keeps the values in memory for the whole test file.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Each test starts with an empty device storage, so `make()` gives an empty store.
beforeEach(async () => {
  await AsyncStorage.clear();
});

describeKeyValueStoreContract(
  'InMemoryKeyValueStore (test fake)',
  () => new InMemoryKeyValueStore(),
);
describeKeyValueStoreContract('DeviceKeyValueStore', () => new DeviceKeyValueStore());

describe('DeviceKeyValueStore', () => {
  it('should_keep_the_value_in_async_storage_when_a_value_is_saved', async () => {
    await new DeviceKeyValueStore().set('progress:hexa-fit', '{"level":3}');

    await expect(AsyncStorage.getItem('progress:hexa-fit')).resolves.toBe('{"level":3}');
  });

  it('should_give_back_the_value_of_an_earlier_store_when_a_new_store_reads_the_key', async () => {
    await new DeviceKeyValueStore().set('progress:hexa-fit', '{"level":3}');

    await expect(new DeviceKeyValueStore().get('progress:hexa-fit')).resolves.toBe('{"level":3}');
  });

  it('should_reject_with_the_error_of_async_storage_when_a_read_fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));

    await expect(new DeviceKeyValueStore().get('progress:hexa-fit')).rejects.toThrow('disk');
  });

  it('should_reject_with_the_error_of_async_storage_when_a_save_fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));

    await expect(new DeviceKeyValueStore().set('progress:hexa-fit', '{"level":3}')).rejects.toThrow(
      'full',
    );
  });
});
