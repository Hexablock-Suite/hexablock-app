import { Stack } from 'expo-router';

import { CompositionRootProvider } from '../src/infrastructure/composition-root-provider';

// The root layout only calls the composition root (issue #162). The provider builds it once,
// and every route reads it. The wiring lives in `src/infrastructure/composition-root.ts`.
export default function RootLayout() {
  return (
    <CompositionRootProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CompositionRootProvider>
  );
}
