import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FigureSelector } from '../src/infrastructure/ui/figure-selector';
import { FigureStone } from '../src/infrastructure/ui/figure-stone';
import { Scenery } from '../src/infrastructure/ui/scenery';
import {
  WORLD_TONE_COUNT,
  column,
  palette,
  radius,
  serif,
  shadow,
  space,
  worldTone,
} from '../src/infrastructure/ui/theme';
import { useFigureShapes, useHomePresenter } from '../src/infrastructure/ui/use-home-presenter';
import { LipButton } from '../src/infrastructure/ui/wood';

// The longer side of one decorative stone.
const STONE = 58;

// The home screen, the MVP view of `HomePresenter` (#169). It shows the suite name and opens
// the game selector map on its own route (S3-11 in #151, a proposal that waits for the team).
// A side button below the play button opens the achievements screen (#188).
// The settings stay on this screen: the language (#163) joins the board figure (#171).
// The player chooses the figure in the figure selector, and the hexagon, the first figure,
// is chosen when the screen opens. The play button passes the text of the chosen figure
// to the map, so the map lists the games of that figure.
// The decorative stones take the shape of the chosen figure (#297, APP-FR-16).
// Every visible text comes from the text catalog through the presenter (APP-FR-11).
export default function HomeScreen() {
  const view = useHomePresenter().home();
  const [figure, setFigure] = useState(view.figures[0]?.id ?? '');
  const stone = useFigureShapes()(figure, STONE);
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xxxl },
      ]}
    >
      <StatusBar style="dark" />
      <Scenery />
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={view.title}
        style={styles.logo}
      >
        <View style={styles.plaque}>
          <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit>
            {view.brand}
          </Text>
        </View>
        <View style={styles.ribbon}>
          <Text style={styles.suite}>{view.suite}</Text>
        </View>
      </View>
      <View
        style={styles.stones}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: WORLD_TONE_COUNT }, (_, position) => (
          <View
            key={position}
            style={[position > 0 && styles.nextStone, position % 2 === 1 && styles.raised]}
          >
            <FigureStone shape={stone} colors={worldTone(position)} />
          </View>
        ))}
      </View>
      <View style={styles.controls}>
        <FigureSelector
          label={view.figure}
          figures={view.figures}
          chosen={figure}
          onChoose={setFigure}
        />
        <LipButton
          label={view.play}
          look="sun"
          onPress={() => router.push({ pathname: '/map', params: { figure } })}
        />
        <LipButton
          label={view.achievements}
          look="panel"
          onPress={() => router.push('/achievements')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    backgroundColor: palette.sky,
  },
  logo: {
    alignItems: 'center',
    maxWidth: '100%',
  },
  plaque: {
    maxWidth: '100%',
    backgroundColor: palette.woodDark,
    borderColor: palette.wood,
    borderRadius: radius.lg,
    borderWidth: 5,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    boxShadow: `0 9px 0 rgba(43, 37, 34, 0.45), ${shadow.sign}`,
  },
  brand: {
    color: palette.sun,
    fontFamily: serif,
    fontSize: 50,
    lineHeight: 60,
    textShadowColor: 'rgba(43, 37, 34, 0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  ribbon: {
    marginTop: -space.md,
    paddingHorizontal: space.xxl,
    paddingVertical: space.xs,
    backgroundColor: palette.ribbon,
    borderRadius: radius.sm,
    boxShadow: `0 4px 0 ${palette.ribbonDeep}`,
    transform: [{ rotate: '-3deg' }],
  },
  suite: {
    color: palette.white,
    fontFamily: serif,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 6,
    textTransform: 'uppercase',
  },
  stones: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  nextStone: {
    marginLeft: space.xs,
  },
  raised: {
    transform: [{ translateY: -STONE / 3 }],
  },
  // The controls fill the screen of a phone and stay in the content column on a wide window.
  controls: {
    ...column,
    alignItems: 'center',
    gap: space.xl,
  },
});
