import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameChoice } from '../src/adapters/home-presenter';
import { HexStone } from '../src/infrastructure/ui/hex-stone';
import { Scenery } from '../src/infrastructure/ui/scenery';
import { palette, serif, space, worldTone } from '../src/infrastructure/ui/theme';
import { useHomePresenter } from '../src/infrastructure/ui/use-home-presenter';
import { LipButton, WoodSign } from '../src/infrastructure/ui/wood';

// The game selector map, the MVP view of `HomePresenter` (#169). It is its own route after
// the home screen (S3-11 in #151, a proposal that waits for the team). It shows one world for
// each game of the registry, in the order of the registry, on a path that climbs from the grass.
// A tap on a world opens the game route with the id of the game. #173 sends Fit and Sort
// to the level selector first, and #170 builds the game screen on the game route.
export default function GameSelectorScreen() {
  const view = useHomePresenter().gameSelector();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Scenery />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        <View style={styles.top}>
          <LipButton label={view.back} look="panel" onPress={() => router.dismissTo('/')} />
        </View>
        <WoodSign style={styles.titleSign}>
          <Text accessibilityRole="header" style={styles.title}>
            {view.title}
          </Text>
        </WoodSign>
        <View style={styles.path}>
          {view.games.map((game, position) => (
            <World key={game.id} game={game} position={position} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// One world of the map: the hex stone of the game and its sign with the name and the place.
// The worlds take turns on the left and on the right side of the path.
function World({ game, position }: { readonly game: GameChoice; readonly position: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/game/[gameId]', params: { gameId: game.id } })}
      style={[styles.world, position % 2 === 0 ? styles.left : styles.right]}
    >
      {({ pressed }) => (
        <>
          <HexStone size={84} colors={worldTone(position)} pressed={pressed} />
          <WoodSign style={styles.worldSign}>
            <Text style={styles.name}>{game.name}</Text>
            <Text style={styles.place}>{game.place}</Text>
          </WoodSign>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.sky,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
  },
  top: {
    alignItems: 'flex-start',
  },
  titleSign: {
    alignSelf: 'center',
    marginTop: space.md,
  },
  title: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 26,
    textAlign: 'center',
  },
  path: {
    flexGrow: 1,
    flexDirection: 'column-reverse',
    gap: space.sm,
    marginTop: space.xl,
  },
  world: {
    alignItems: 'center',
    gap: space.xs,
    width: 148,
  },
  left: {
    alignSelf: 'flex-start',
  },
  right: {
    alignSelf: 'flex-end',
  },
  worldSign: {
    alignSelf: 'stretch',
  },
  name: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 18,
    textAlign: 'center',
  },
  place: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 12,
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
