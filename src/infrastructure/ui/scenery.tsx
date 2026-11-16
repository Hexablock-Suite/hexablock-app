import { StyleSheet, View } from 'react-native';

import { palette } from './theme';

// The scene behind the home screen and the game selector map: sky, clouds, hills and grass,
// as in the team prototype. It is decoration, so it takes no touch and no screen reader focus.
// The scene keeps its colors in the dark mode of the system: each text sits on its own panel.
export function Scenery() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.cloud, styles.cloudLeft]} />
      <View style={[styles.cloud, styles.cloudRight]} />
      <View style={[styles.hill, styles.hillLeft]} />
      <View style={[styles.hill, styles.hillRight]} />
      <View style={styles.grass} />
      <View style={styles.grassShade} />
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: {
    position: 'absolute',
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.cloud,
    opacity: 0.9,
  },
  cloudLeft: { top: '9%', left: '8%', width: 76 },
  cloudRight: { top: '15%', right: '10%', width: 54 },
  hill: {
    position: 'absolute',
    bottom: '16%',
    height: '24%',
    backgroundColor: palette.hill,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  hillLeft: { left: '-25%', width: '85%' },
  hillRight: { right: '-30%', width: '95%', height: '19%' },
  grass: {
    position: 'absolute',
    bottom: 0,
    left: '-20%',
    right: '-20%',
    height: '24%',
    backgroundColor: palette.grass,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  grassShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '12%',
    backgroundColor: palette.grassShade,
    opacity: 0.35,
  },
});
