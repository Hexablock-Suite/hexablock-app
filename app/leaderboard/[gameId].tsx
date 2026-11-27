import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameChoice } from '../../src/adapters/home-presenter';
import type { LeaderboardRowView } from '../../src/adapters/leaderboard-presenter';
import { LevelId } from '../../src/domain/progress/level-id';
import { GameId } from '../../src/domain/shared/game-id';
import { gameRouteIds } from '../../src/infrastructure/route-ids';
import { Scenery } from '../../src/infrastructure/ui/scenery';
import { column, palette, radius, serif, space } from '../../src/infrastructure/ui/theme';
import {
  useHomePresenter,
  useRouteFigure,
  type RouteFigure,
} from '../../src/infrastructure/ui/use-home-presenter';
import { useLeaderboard } from '../../src/infrastructure/ui/use-leaderboard';
import { LipButton, WoodSign } from '../../src/infrastructure/ui/wood';

// The leaderboard screen, the MVP view of `LeaderboardPresenter` (#47, APP-FR-14, classes.md
// decision 67). The map opens it from the button of each world with the id of the game: it shows
// the global board of the game (S3-03). The level selector opens it from the button of a completed
// level with the id of the level in the `levelId` parameter: it shows the board of that level
// (DS-4). Both boards come from hexablock-api and need a signed-in player.
// The screen shows the name of the game and one row per player, in the order and with the rank of
// the backend: a full tie shows one rank twice. It shows a loading text until the answer, the text
// of an empty board, and the text of a failure as an alert. With no session or a refused token,
// the alert asks the player to sign in, and its button opens the account screen.
// The back button goes to the screen before, or to the map of the figure when the route opened
// first. Every visible text comes from the text catalog (APP-FR-11).
// A text that names no figure goes home. An id that names no game of the figure goes back to the
// map of the figure. A blank level id names no level. A repeated parameter reaches the route as a
// list, so the route reads the first value of `gameId` and of `levelId`.
export default function LeaderboardScreen() {
  const params = useLocalSearchParams<{ gameId: string | string[]; levelId?: string | string[] }>();
  const gameId = firstOf(params.gameId);
  const levelId = firstOf(params.levelId);
  const figure = useRouteFigure();
  const games = useHomePresenter(figure?.figure).gameSelector().games;
  if (figure === undefined) return <Redirect href="/" />;
  const game = games.find((choice) => choice.id === gameId);
  if (game === undefined) {
    return <Redirect href={{ pathname: '/map', params: { figure: figure.param } }} />;
  }
  return (
    <Board
      key={`${figure.param}/${game.id}/${levelId ?? ''}`}
      game={game}
      figure={figure}
      levelId={levelId}
    />
  );
}

// The first value of a route parameter. A repeated parameter arrives as a list.
function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// The pages of this route that the web export renders, one for each registered game (#287).
// Expo Router calls it at build time when `web.output` is `static`.
export function generateStaticParams(): { gameId: string }[] {
  return gameRouteIds().map((gameId) => ({ gameId }));
}

// The board of one game, or of one level of the game. The presenter lives as long as the screen.
function Board({
  game,
  figure,
  levelId,
}: {
  readonly game: GameChoice;
  readonly figure: RouteFigure;
  readonly levelId?: string;
}) {
  const [level] = useState(() =>
    levelId === undefined || levelId.trim() === '' ? undefined : LevelId.of(levelId),
  );
  const view = useLeaderboard(GameId.of(game.id), level);
  const insets = useSafeAreaInsets();
  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/map', params: { figure: figure.param } });
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
          <LipButton label={view.back} look="panel" onPress={goBack} />
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
              <View style={styles.failure}>
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  style={styles.error}
                >
                  <Text style={styles.errorText}>{view.error}</Text>
                </View>
                {view.signIn === undefined ? null : (
                  <LipButton
                    label={view.signIn}
                    look="sun"
                    onPress={() => router.push('/account')}
                  />
                )}
              </View>
            )}
            {view.rows.map((row, position) => (
              <Row key={row.id} row={row} position={position} />
            ))}
          </View>
        </WoodSign>
      </ScrollView>
    </View>
  );
}

// One row of the board: the rank, the name of the player and the record.
function Row({ row, position }: { readonly row: LeaderboardRowView; readonly position: number }) {
  return (
    <View testID="leaderboard-row" style={[styles.row, position > 0 && styles.nextRow]}>
      <Text style={styles.rank}>{row.rank}</Text>
      <View style={styles.texts}>
        <Text style={styles.name}>{row.name}</Text>
        <Text style={styles.value}>{row.value}</Text>
      </View>
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
  note: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 16,
    fontStyle: 'italic',
    paddingVertical: space.sm,
  },
  failure: {
    alignItems: 'center',
    gap: space.md,
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
  nextRow: {
    borderTopColor: palette.trim,
    borderTopWidth: 1,
  },
  rank: {
    minWidth: 28,
    color: palette.woodDark,
    fontFamily: serif,
    fontSize: 20,
    textAlign: 'center',
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
  value: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 13,
  },
});
