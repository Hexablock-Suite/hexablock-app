// Setup of the `app` project of Jest. It runs before each test file of that project.
// The device storage of the app is AsyncStorage. Its native module is missing under Jest,
// and the package throws when a test imports it without a mock. The root layout gives the
// composition root `DeviceKeyValueStore` (#188), so every router test imports it.
// The official mock keeps the values in memory, as the device does.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The Merge controls take a swipe with `react-native-gesture-handler` (#292). Its native module
// is missing under Jest too. The official setup of the package mocks it and its host views,
// so a test fires a gesture with `react-native-gesture-handler/jest-utils`.
require('react-native-gesture-handler/jestSetup');

// The gesture library loads Reanimated when it can. Under Jest the mock of Reanimated 4.7.1
// throws while it loads, and the mocks of the router testing library then give an empty module
// in its place, which breaks the gesture library. The swipe of Merge uses no worklet
// (`disableReanimated`), so under Jest the gesture library runs with no Reanimated and no Worklets.
jest.mock('react-native-gesture-handler/lib/module/handlers/gestures/reanimatedWrapper', () => ({
  Reanimated: undefined,
  Worklets: undefined,
}));
