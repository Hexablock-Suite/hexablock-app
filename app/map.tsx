import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameChoice } from '../src/adapters/home-presenter';
import { HexStone } from '../src/infrastructure/ui/hex-stone';
import { Scenery } from '../src/infrastructure/ui/scenery';
import { palette, serif, space, type WorldTone } from '../src/infrastructure/ui/theme';
import {
  useGameTones,
  useHomePresenter,
  useRouteFigure,
  type RouteFigure,
} from '../src/infrastructure/ui/use-home-presenter';
import { LipButton, WoodSign } from '../src/infrastructure/ui/wood';

// The game selector map, the MVP view of `HomePresenter` (#169). It is its own route after
// the home screen (S3-11 in #151, a proposal that waits for the team). It shows one world for
// each game of the registry, in the order of the registry, on a path that climbs from the grass.
// A tap on a world opens the game route with the id of the game. #173 sends Fit and Sort
// to the level selector first, and #170 builds the game screen on the game route.
// The map lists the games of the board figure that its route names, by default the hexagon,
// and passes the figure on to the game route (#171). A text that names no figure goes home.
export default function GameSelectorScreen() {
  const figure = useRouteFigure();
  if (figure === undefined) return <Redirect href="/" />;
  return <GameSelector figure={figure} />;
}

// The map of the games of the board figure `figure`.
function GameSelector({ figure }: { readonly figure: RouteFigure }) {
  const view = useHomePresenter(figure.figure).gameSelector();
  const toneOf = useGameTones(figure.figure);
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
            <World
              key={game.id}
              game={game}
              tone={toneOf(game.id)}
              figure={figure.param}
              position={position}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// One world of the map: the hex stone of the game and its sign with the name and the place.
// The stone takes `tone`, the colors that the registry entry of the game declares, so a game
// keeps its color on every figure (#298).
// The worlds take turns on the left and on the right side of the path by their place in the
// list, not by the game. So the path keeps its zig-zag when a figure has no entry for a game.
// A tap opens the game on the board figure whose text is `figure`.
function World({
  game,
  tone,
  figure,
  position,
}: {
  readonly game: GameChoice;
  readonly tone: WorldTone;
  readonly figure: string;
  readonly position: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/game/[gameId]', params: { gameId: game.id, figure } })
      }
      style={[styles.world, position % 2 === 0 ? styles.left : styles.right]}
    >
      {({ pressed }) => (
        <>
          <HexStone size={84} colors={tone} pressed={pressed} />
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
