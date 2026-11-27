import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameChoice } from '../../src/adapters/home-presenter';
import type { LevelChoice } from '../../src/adapters/level-selector-presenter';
import { GameId } from '../../src/domain/shared/game-id';
import type { CellShape } from '../../src/adapters/board/board-layout';
import { FigureStone } from '../../src/infrastructure/ui/figure-stone';
import { Scenery } from '../../src/infrastructure/ui/scenery';
import {
  column,
  palette,
  radius,
  serif,
  space,
  type WorldTone,
} from '../../src/infrastructure/ui/theme';
import {
  useFigureShapes,
  useHomePresenter,
  useRouteFigure,
  type RouteFigure,
} from '../../src/infrastructure/ui/use-home-presenter';
import { levelRouteIds } from '../../src/infrastructure/route-ids';
import { useLevelSelector } from '../../src/infrastructure/ui/use-level-selector';
import { LipButton, WoodSign } from '../../src/infrastructure/ui/wood';

// The longer side of the stone in front of each level.
const STONE = 34;
// A completed level shows a sun stone, an open level a wood stone and a locked level a pale
// stone. Each row also says its status as a text, so the color is never the only sign.
const COMPLETED_STONE: WorldTone = { tone: palette.sun, wash: palette.cloud };
const OPEN_STONE: WorldTone = { tone: palette.woodLight, wash: palette.panel };
const LOCKED_STONE: WorldTone = { tone: palette.trim, wash: palette.panel };

// The level selector, the MVP view of `LevelSelectorPresenter` (#173, APP-FR-02). The map opens
// it for a game with levels, Fit and Sort, with the id of the game and the text of the board
// figure. It shows the name of the game and each level of the game on that figure as completed,
// open or locked, with the stars of a completed level. A press on a level that is not locked
// opens the game route with the id of the level, and a locked level does not start.
// A completed level also shows a button that opens the leaderboard of that level (#47).
// After the levels, a section with its own header lists each unavailable level of the game (#307):
// the backend keeps the level, but the level breaks a rule. Its row names the level by its id,
// says that it is not available and is disabled, as a locked row is. It has no leaderboard button.
// The screen shows a loading text until the first answer, the text of no levels when the figure
// has none, and the text of a failed read as an alert. The map button goes back to the map
// of the figure. Every visible text comes from the text catalog (APP-FR-11).
// A text that names no figure goes home. An id that names no game of the figure goes back
// to the map of the figure.
export default function LevelSelectorScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const figure = useRouteFigure();
  const games = useHomePresenter(figure?.figure).gameSelector().games;
  if (figure === undefined) return <Redirect href="/" />;
  const game = games.find((choice) => choice.id === gameId);
  if (game === undefined) {
    return <Redirect href={{ pathname: '/map', params: { figure: figure.param } }} />;
  }
  return <LevelSelector key={`${figure.param}/${game.id}`} game={game} figure={figure} />;
}

// The pages of this route that the web export renders, one for each game with levels (#287).
// Expo Router calls it at build time when `web.output` is `static`.
export function generateStaticParams(): { gameId: string }[] {
  return levelRouteIds().map((gameId) => ({ gameId }));
}

// The levels of one game on one board figure. The presenter lives as long as the screen.
function LevelSelector({
  game,
  figure,
}: {
  readonly game: GameChoice;
  readonly figure: RouteFigure;
}) {
  const view = useLevelSelector(GameId.of(game.id), figure.figure);
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
          <LipButton
            label={view.back}
            look="panel"
            onPress={() => router.dismissTo({ pathname: '/map', params: { figure: figure.param } })}
          />
        </View>
        <WoodSign style={styles.titleSign}>
          <Text accessibilityRole="header" style={styles.title}>
            {game.name}
          </Text>
        </WoodSign>
        <WoodSign style={styles.listSign}>
          <View style={styles.list}>
            <Text accessibilityRole="header" style={styles.listTitle}>
              {view.title}
            </Text>
            {view.loading === undefined ? null : (
              <Text accessibilityLiveRegion="polite" style={styles.note}>
                {view.loading}
              </Text>
            )}
            {view.empty === undefined ? null : <Text style={styles.note}>{view.empty}</Text>}
            {view.error === undefined ? null : (
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                style={styles.error}
              >
                <Text style={styles.errorText}>{view.error}</Text>
              </View>
            )}
            {view.levels.map((level, position) => (
              <Level
                key={level.id}
                level={level}
                shape={stone}
                position={position}
                onStart={() =>
                  router.push({
                    pathname: '/game/[gameId]',
                    params: { gameId: game.id, figure: figure.param, levelId: level.id },
                  })
                }
                onBoard={() =>
                  router.push({
                    pathname: '/leaderboard/[gameId]',
                    params: { gameId: game.id, figure: figure.param, levelId: level.id },
                  })
                }
              />
            ))}
            {view.unavailable === undefined ? null : (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {view.unavailable.title}
                </Text>
                {view.unavailable.levels.map((level, position) => (
                  <Level
                    key={level.id}
                    level={level}
                    shape={stone}
                    position={position}
                    onStart={() => undefined}
                    onBoard={() => undefined}
                  />
                ))}
              </View>
            )}
          </View>
        </WoodSign>
      </ScrollView>
    </View>
  );
}

// One level: the stone of its status in the shape of the figure, its name, its status and the
// stars of a completed level. A press starts the level. A locked level is disabled.
// A completed level also has the button of its leaderboard (#47), beside the level button,
// so each button keeps its own name.
function Level({
  level,
  shape,
  position,
  onStart,
  onBoard,
}: {
  readonly level: LevelChoice;
  readonly shape: CellShape;
  readonly position: number;
  readonly onStart: () => void;
  readonly onBoard: () => void;
}) {
  const tone = level.completed ? COMPLETED_STONE : level.playable ? OPEN_STONE : LOCKED_STONE;
  return (
    <View style={[styles.row, position > 0 && styles.nextRow]}>
      <Pressable
        accessibilityRole="button"
        disabled={!level.playable}
        onPress={onStart}
        style={[styles.level, !level.playable && styles.locked]}
      >
        {({ pressed }) => (
          <>
            <FigureStone shape={shape} colors={tone} pressed={pressed} />
            <View style={styles.texts}>
              <Text style={styles.name}>{level.name}</Text>
              <Text style={styles.status}>{level.status}</Text>
            </View>
            {level.stars === undefined ? null : <Text style={styles.stars}>{level.stars}</Text>}
          </>
        )}
      </Pressable>
      {level.leaderboard === undefined ? null : (
        <LipButton label={level.leaderboard} look="panel" onPress={onBoard} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.sky,
  },
  // The list fills the screen of a phone and stays in the content column on a wide window.
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
  listSign: {
    alignSelf: 'stretch',
    marginTop: space.xl,
  },
  list: {
    alignSelf: 'stretch',
  },
  listTitle: {
    color: palette.woodDark,
    fontFamily: serif,
    fontSize: 20,
    marginBottom: space.xs,
  },
  // The section of the unavailable levels starts below the last level, after a rule.
  section: {
    alignSelf: 'stretch',
    borderTopColor: palette.woodDark,
    borderTopWidth: 1,
    marginTop: space.md,
    paddingTop: space.sm,
  },
  sectionTitle: {
    color: palette.woodDark,
    fontFamily: serif,
    fontSize: 17,
    marginBottom: space.xs,
  },
  note: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 16,
    fontStyle: 'italic',
    paddingVertical: space.sm,
  },
  error: {
    alignSelf: 'stretch',
    marginTop: space.sm,
    backgroundColor: palette.panel,
    borderColor: palette.ribbon,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  errorText: {
    color: palette.ribbonDeep,
    fontFamily: serif,
    fontSize: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    gap: space.md,
  },
  nextRow: {
    borderTopColor: palette.trim,
    borderTopWidth: 1,
  },
  locked: {
    opacity: 0.6,
  },
  texts: {
    flexGrow: 1,
    flexShrink: 1,
  },
  name: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 17,
  },
  status: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 13,
  },
  stars: {
    color: palette.sunInk,
    fontFamily: serif,
    fontSize: 14,
  },
});
