import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameChoice } from '../src/adapters/home-presenter';
import type { CellShape } from '../src/infrastructure/board/board-layout';
import { useCompositionRoot } from '../src/infrastructure/composition-root-provider';
import { FigureStone } from '../src/infrastructure/ui/figure-stone';
import { Scenery } from '../src/infrastructure/ui/scenery';
import { column, palette, serif, space, type WorldTone } from '../src/infrastructure/ui/theme';
import {
  homePresenterOf,
  useFigureShapes,
  useGameLevels,
  useGameTones,
  useRouteFigure,
  useSavedProgresses,
  type RouteFigure,
} from '../src/infrastructure/ui/use-home-presenter';
import { LipButton, WoodSign } from '../src/infrastructure/ui/wood';

// The longer side of the stone of a world.
const STONE = 84;

// The game selector map, the MVP view of `HomePresenter` (#169). It is its own route after
// the home screen (S3-11 in #151, a proposal that waits for the team). It shows one world for
// each game of the registry, in the order of the registry, on a path that climbs from the grass.
// A tap on a world opens the level selector of a game with levels, Fit and Sort (#173),
// and the game route of a game with none, Lines and Merge (#170). The registry entry of each
// game says whether it has levels, so the map does not branch on the game id.
// The map lists the games of the board figure that its route names, by default the hexagon,
// and passes the figure on to the game route (#171). A text that names no figure goes home.
export default function GameSelectorScreen() {
  const figure = useRouteFigure();
  if (figure === undefined) return <Redirect href="/" />;
  return <GameSelector figure={figure} />;
}

// The map of the games of the board figure `figure`. It renders before the saved progress
// arrives, and the hook of the map re-renders it with the records (#181).
function GameSelector({ figure }: { readonly figure: RouteFigure }) {
  const root = useCompositionRoot();
  // The registered games of the figure, once per figure, so the load runs once per list.
  const games = useMemo(() => root.registry(figure.figure).gameIds(), [root, figure.figure]);
  const saved = useSavedProgresses(games);
  const view = homePresenterOf(root, figure.figure, saved).gameSelector();
  const toneOf = useGameTones(figure.figure);
  const hasLevels = useGameLevels(figure.figure);
  const stone = useFigureShapes()(figure.param, STONE);
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
              shape={stone}
              figure={figure.param}
              hasLevels={hasLevels(game.id)}
              position={position}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// One world of the map: the stone of the game and its sign with the name and the place.
// The sign also shows the saved high score of the game when the device keeps one (#181).
// The stone has `shape`, the shape of the board figure of the map (#297, APP-FR-16).
// The stone takes `tone`, the colors that the registry entry of the game declares, so a game
// keeps its color on every figure (#298).
// The worlds take turns on the left and on the right side of the path by their place in the
// list, not by the game. So the path keeps its zig-zag when a figure has no entry for a game.
// A tap opens the game on the board figure whose text is `figure`: the level selector of a game
// with levels (#173), or else the game route.
function World({
  game,
  tone,
  shape,
  figure,
  hasLevels,
  position,
}: {
  readonly game: GameChoice;
  readonly tone: WorldTone;
  readonly shape: CellShape;
  readonly figure: string;
  readonly hasLevels: boolean;
  readonly position: number;
}) {
  const params = { gameId: game.id, figure };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push(
          hasLevels
            ? { pathname: '/levels/[gameId]', params }
            : { pathname: '/game/[gameId]', params },
        )
      }
      style={[styles.world, position % 2 === 0 ? styles.left : styles.right]}
    >
      {({ pressed }) => (
        <>
          <FigureStone shape={shape} colors={tone} pressed={pressed} />
          <WoodSign style={styles.worldSign}>
            <Text style={styles.name}>{game.name}</Text>
            <Text style={styles.place}>{game.place}</Text>
            {game.highScore === undefined ? null : (
              <Text style={styles.record}>{game.highScore}</Text>
            )}
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
  // The path of the worlds fills the screen of a phone and stays in the content column
  // on a wide window, so the worlds keep their zig-zag near the center.
  content: {
    ...column,
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
  record: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 12,
    textAlign: 'center',
  },
});
