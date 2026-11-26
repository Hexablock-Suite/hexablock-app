// Wrong example: an adapter imports a storage package, as DeviceKeyValueStore does.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const localProgress = AsyncStorage;
