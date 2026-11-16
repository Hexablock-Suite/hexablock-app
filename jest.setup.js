// Setup of the `app` project of Jest. It runs before each test file of that project.
// The device storage of the app is AsyncStorage. Its native module is missing under Jest,
// and the package throws when a test imports it without a mock. The root layout gives the
// composition root `DeviceKeyValueStore` (#188), so every router test imports it.
// The official mock keeps the values in memory, as the device does.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
