import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CompositionRootProvider } from '../src/infrastructure/composition-root-provider';

// The root layout only calls the composition root (issue #162). The provider builds it once,
// and every route reads it. The wiring lives in `src/infrastructure/composition-root.ts`.
// The root view of `react-native-gesture-handler` wraps the app, so a gesture of a screen
// is recognized, as the swipe of Hexa Merge (#292).
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <CompositionRootProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </CompositionRootProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
