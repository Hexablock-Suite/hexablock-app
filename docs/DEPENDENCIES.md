# Dependencies

This file explains every entry of the `dependencies` and the `devDependencies` maps of [`package.json`](../package.json) with one truthful reason. The gate [`test/gates/dependencies-gate.test.ts`](../test/gates/dependencies-gate.test.ts) fails when `package.json` lists a package that this file does not explain. A package counts as explained only when a list-item line here starts with its backticked name and continues with a reason that is not empty. The check is one-way: a line here about a package that `package.json` no longer lists fails nothing, and a prose mention of a package does not explain it (rule R-dependencies-doc).

Add Expo and React Native packages with `npx expo install` (rule R-expo-install), and add the line here in the same pull request.

## Dependencies

- `@expo/ui` — part of the dependency set of the Expo SDK 58 default template (commit `28bdbb4`), and `expo-router` lists it as an optional peer; no source file or test imports it today. Keeping or removing it is a separate team decision, recorded on [#186](https://github.com/Hexablock-Suite/hexablock-app/issues/186).
- `@react-native-async-storage/async-storage` — the device storage: `DeviceKeyValueStore` in `src/infrastructure/device-key-value-store.ts` keeps the text values of the local repositories, such as `LocalProgressRepository`, over AsyncStorage. `jest.setup.js` loads its official mock.
- `expo` — the Expo SDK 58: the `expo start` and `expo export` scripts, the `expo` section of `app.json`, the `expo/tsconfig.base` that `tsconfig.json` extends, and the `npx expo prebuild` of the APK release.
- `expo-constants` — a required peer of `expo-router`, which reads the app config through it; `expo` and `expo-linking` also depend on it. No source file imports it.
- `expo-device` — part of the dependency set of the Expo SDK 58 default template (commit `28bdbb4`); no source file or test imports it today. Keeping or removing it is a separate team decision, recorded on [#186](https://github.com/Hexablock-Suite/hexablock-app/issues/186).
- `expo-font` — a required peer of `expo-symbols`, and a dependency of `expo`. No source file loads a font with it today.
- `expo-glass-effect` — part of the dependency set of the Expo SDK 58 default template (commit `28bdbb4`), and `expo-router` depends on it; no source file or test imports it today. Keeping or removing it is a separate team decision, recorded on [#186](https://github.com/Hexablock-Suite/hexablock-app/issues/186).
- `expo-image` — part of the dependency set of the Expo SDK 58 default template (commit `28bdbb4`); no source file or test imports it today. Keeping or removing it is a separate team decision, recorded on [#186](https://github.com/Hexablock-Suite/hexablock-app/issues/186).
- `expo-linking` — a required peer of `expo-router`, which builds and reads the deep links of the `scheme` of `app.json` with it. No source file imports it.
- `expo-router` — the file-based routes of `app/`: the `main` entry `expo-router/entry`, its config plugin in `app.json`, and `Stack`, `router`, `Redirect` and `useLocalSearchParams` in the screens and in `src/infrastructure/ui/use-home-presenter.ts`.
- `expo-splash-screen` — the launch screen: its config plugin in `app.json` sets the background color and the image.
- `expo-status-bar` — the `StatusBar` of the screens in `app/` and of `src/infrastructure/ui/game-stage.tsx`.
- `expo-symbols` — part of the dependency set of the Expo SDK 58 default template (commit `28bdbb4`), and `expo-router` lists it as an optional peer; no source file or test imports it today. Keeping or removing it is a separate team decision, recorded on [#186](https://github.com/Hexablock-Suite/hexablock-app/issues/186).
- `expo-system-ui` — the native side of the `userInterfaceStyle` of `app.json`: `npx expo prebuild` applies its config plugin by default and writes the style into the native projects. No source file imports it.
- `expo-web-browser` — part of the dependency set of the Expo SDK 58 default template (commit `28bdbb4`); no source file or test imports it today. Keeping or removing it is a separate team decision, recorded on [#186](https://github.com/Hexablock-Suite/hexablock-app/issues/186).
- `openapi-fetch` — the HTTP client of the backend: `createClient` in `src/infrastructure/api/client.ts`, typed by the generated `src/infrastructure/api/schema.d.ts` and `src/adapters/api/dto.d.ts`.
- `react` — the UI library of every screen in `app/` and every component of `src/infrastructure/`, with hooks such as `useState` and `useEffect`.
- `react-dom` — the DOM renderer that `react-native-web` needs for the web build of the team (`pnpm web`, `pnpm web:build`); `expo` lists it as an optional peer. No source file imports it.
- `react-native` — the core components and APIs of the screens: `View`, `Text`, `Pressable`, `ScrollView`, `StyleSheet`, `useWindowDimensions`, and `Platform` in `src/infrastructure/ui/theme.ts`.
- `react-native-gesture-handler` — the swipe of the Hexa Merge controls (`GestureDetector` and `usePanGesture` in `src/infrastructure/ui/merge-controls.tsx`) and the `GestureHandlerRootView` of `app/_layout.tsx`. `jest.setup.js` loads its official Jest setup.
- `react-native-reanimated` — an optional peer of `expo-router`, and the gesture library loads it when it is installed. The Merge swipe sets `disableReanimated`, and `jest.setup.js` hides it under Jest. No source file imports it.
- `react-native-safe-area-context` — `useSafeAreaInsets` in the screens of `app/`, and the `SafeAreaProvider` of the screen tests; also a required peer of `expo-router`.
- `react-native-screens` — the native screen containers under the `Stack` of `expo-router`, which depends on it and lists it as a required peer. No source file imports it.
- `react-native-svg` — the `Svg` and `Polygon` that draw the outline of each board cell in `src/infrastructure/board/cell-outline.tsx`.
- `react-native-web` — runs the React Native components in the browser for the web build of the team (`pnpm web`, `pnpm web:build`, #287); `expo` lists it as an optional peer. `test/gates/platform-gate.test.ts` treats it as a platform module.
- `react-native-worklets` — the required peer of `react-native-reanimated` 4 (`0.13.x`); `expo-router` and `@expo/ui` list it as an optional peer. No source file imports it.

## devDependencies

- `@commitlint/cli` — the `commitlint` of the commit-message hook `.vite-hooks/commit-msg` and of `test/gates/commit-message-gate.test.ts` (rule R-conventional-commits).
- `@commitlint/config-conventional` — the Conventional Commits preset that `commitlint.config.cjs` extends.
- `@pact-foundation/pact` — both sides of the contract: `PactV4` in `test/contract/` writes the pact of `pacts/`, and the `Verifier` of `scripts/contract/verify-provider.mjs` runs `pnpm contract:verify` in the CI job contract (rule R-api-contract).
- `@testing-library/react-native` — `render`, `screen` and `fireEvent` of the screen and component tests in `test/app/` and `test/infrastructure/`, and of the helpers in `test/support/ui/`.
- `@types/jest` — the types of the Jest globals: the `types` entry `jest` of `tsconfig.json` loads them, so `pnpm typecheck` checks the tests.
- `@types/node` — the Node types of the `types` entry `node` of `tsconfig.json`, for the `node:fs` and `node:path` imports of the tests and the gates.
- `@types/react` — the types of the `react` imports: the `react` package ships no types of its own.
- `dependency-cruiser` — the layer rules of `.dependency-cruiser.cjs`, run by the `arch` script and by `test/gates/architecture-gate.test.ts`.
- `jest` — the test runner of the `test` script, configured in `jest.config.js` with the projects `app` and `contract`.
- `jest-expo` — the Jest preset of the `app` project of `jest.config.js`; the `contract` project reuses its TypeScript transform.
- `openapi-typescript` — `scripts/contract/api-types.mjs`: `pnpm api:generate` writes `src/infrastructure/api/schema.d.ts` and `src/adapters/api/dto.d.ts` from the backend OpenAPI document, and `pnpm api:check` compares both in the CI job contract.
- `typescript` — the compiler of the `typecheck` script (`tsc --noEmit`), and the parser with which gate and docs tests read the code, such as `test/gates/state-writes-gate.test.ts` and `test/docs/primitive-types.test.ts`.
- `vite-plus` — the `defineConfig` of `vite.config.ts`, the `vp` linter and formatter of the `lint`, `format` and `format:check` scripts, the `vp staged` of the pre-commit hook, the `prepare` script that installs the git hooks, and the plugin API of `scripts/lint/hexablock-plugin.mjs`.
