import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AchievementSection } from '../src/adapters/achievements-presenter';
import { HexStone } from '../src/infrastructure/ui/hex-stone';
import { Scenery } from '../src/infrastructure/ui/scenery';
import { palette, radius, serif, space, type WorldTone } from '../src/infrastructure/ui/theme';
import { useAchievements } from '../src/infrastructure/ui/use-achievements';
import { LipButton, WoodSign } from '../src/infrastructure/ui/wood';

// The width of the stone in front of each achievement.
const STONE = 30;
// A completed achievement shows a sun stone, and an achievement in progress a wood stone.
// The section header also says the status, so the color is never the only sign.
const COMPLETED_STONE: WorldTone = { tone: palette.sun, wash: palette.cloud };
const PENDING_STONE: WorldTone = { tone: palette.woodLight, wash: palette.panel };

// The achievements screen, the MVP view of `AchievementsPresenter` (#188). It shows each
// achievement of the player in one of two wood signs: in progress, then completed.
// Each sign shows a text when it holds no achievement. The screen shows a loading text until
// the first answer, and the text of a failed read as an alert.
// The back button goes to the screen before, or home when the route opened first.
// Every visible text comes from the text catalog through the presenter (APP-FR-11).
export default function AchievementsScreen() {
  const view = useAchievements();
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
          <LipButton label={view.back} look="panel" onPress={goBack} />
        </View>
        <WoodSign style={styles.titleSign}>
          <Text accessibilityRole="header" style={styles.title}>
            {view.title}
          </Text>
        </WoodSign>
        {view.loading === undefined ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.loading}>
            {view.loading}
          </Text>
        )}
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
        {view.sections.map((section) => (
          <Section key={section.title} section={section} />
        ))}
      </ScrollView>
    </View>
  );
}

// One wood sign with the header of its status and one row for each achievement.
function Section({ section }: { readonly section: AchievementSection }) {
  return (
    <WoodSign style={styles.sectionSign}>
      <View
        testID={section.completed ? 'achievements-completed' : 'achievements-in-progress'}
        style={styles.section}
      >
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {section.title}
        </Text>
        {section.items.length === 0 ? (
          <Text style={styles.empty}>{section.empty}</Text>
        ) : (
          section.items.map((item, position) => (
            <View key={item.id} accessible style={[styles.row, position > 0 && styles.nextRow]}>
              <HexStone size={STONE} colors={section.completed ? COMPLETED_STONE : PENDING_STONE} />
              <Text style={styles.name}>{item.name}</Text>
            </View>
          ))
        )}
      </View>
    </WoodSign>
  );
}

// Goes to the screen before. A route that opened first goes home.
function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
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
  loading: {
    alignSelf: 'center',
    marginTop: space.xl,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: palette.panel,
    borderRadius: radius.md,
    color: palette.ink,
    fontFamily: serif,
    fontSize: 16,
  },
  error: {
    alignSelf: 'stretch',
    marginTop: space.xl,
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
  sectionSign: {
    alignSelf: 'stretch',
    marginTop: space.xl,
  },
  section: {
    alignSelf: 'stretch',
  },
  sectionTitle: {
    color: palette.woodDark,
    fontFamily: serif,
    fontSize: 20,
    marginBottom: space.xs,
  },
  empty: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 16,
    fontStyle: 'italic',
    paddingVertical: space.sm,
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
  name: {
    flexShrink: 1,
    color: palette.ink,
    fontFamily: serif,
    fontSize: 17,
  },
});
