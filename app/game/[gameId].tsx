import { Redirect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { Scenery } from '../../src/infrastructure/ui/scenery';
import { palette, serif, space } from '../../src/infrastructure/ui/theme';
import { useHomePresenter } from '../../src/infrastructure/ui/use-home-presenter';
import { WoodSign } from '../../src/infrastructure/ui/wood';

// The game route, a placeholder until #170. The game selector map opens it with the id of
// a registered game, and it shows the name of that game. #170 replaces this view with
// `GameScreen`, which starts the game through the use cases of the composition root.
// An id that names no registered game goes back to the map.
export default function GamePlaceholderScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useHomePresenter()
    .gameSelector()
    .games.find((choice) => choice.id === gameId);
  if (game === undefined) return <Redirect href="/map" />;
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Scenery />
      <WoodSign>
        <Text accessibilityRole="header" style={styles.name}>
          {game.name}
        </Text>
      </WoodSign>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: palette.sky,
  },
  name: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 30,
  },
});
