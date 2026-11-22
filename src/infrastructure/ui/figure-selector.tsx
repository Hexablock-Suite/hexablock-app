import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FigureChoice } from '../../adapters/home-presenter';
import type { CellShape } from '../board/board-layout';
import { FigureOutline } from './figure-stone';
import { lip, palette, radius, serif, space } from './theme';
import { useFigureShapes } from './use-home-presenter';
import { WoodSign } from './wood';

// The longer side of the glyph of a figure.
const GLYPH = 26;

// The two looks of a choice, as the two looks of `LipButton`: the chosen figure is sun-yellow,
// and each other figure has a white face on the light panel of the sign.
const LOOKS = {
  chosen: { face: palette.sun, lip: palette.sunDeep, ink: palette.sunInk, border: palette.sun },
  other: {
    face: palette.white,
    lip: palette.woodLight,
    ink: palette.woodDark,
    border: palette.trim,
  },
} as const;

// The figure selector of the home screen (APP-FR-16, issue #171): one choice for each board figure
// of the composition root, on a wood sign with its label. The choices make a radio group,
// so the screen reader reads each figure and whether it is chosen. A tap on a figure chooses it.
// Each choice sinks onto its lip when it is pressed, as `LipButton` does.
export function FigureSelector({
  label,
  figures,
  chosen,
  onChoose,
}: {
  readonly label: string;
  readonly figures: readonly FigureChoice[];
  readonly chosen: string;
  readonly onChoose: (id: string) => void;
}) {
  const shapeOf = useFigureShapes();
  return (
    <WoodSign style={styles.sign}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {figures.map((figure) => (
          <Choice
            key={figure.id}
            figure={figure}
            glyph={shapeOf(figure.id, GLYPH)}
            checked={figure.id === chosen}
            onPress={() => onChoose(figure.id)}
          />
        ))}
      </View>
    </WoodSign>
  );
}

// One figure of the selector: its glyph and its name on a face over a lip.
// The glyph is `glyph`, the shape of the figure from the composition root (#297),
// which the layout of the figure gives. So the selector does not branch on the figure. The glyph is decoration:
// the name of the figure below it carries the meaning.
function Choice({
  figure,
  glyph,
  checked,
  onPress,
}: {
  readonly figure: FigureChoice;
  readonly glyph: CellShape;
  readonly checked: boolean;
  readonly onPress: () => void;
}) {
  const colors = checked ? LOOKS.chosen : LOOKS.other;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.choice}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.lip, { backgroundColor: colors.lip }]} />
          <View
            style={[
              styles.face,
              { backgroundColor: colors.face, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={styles.glyph}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <FigureOutline shape={glyph} layers={[{ scale: 1, fill: colors.ink }]} />
            </View>
            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
              {figure.name}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The sign is at most 360 points wide, and it stays centered on a wider screen (#287).
  sign: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
  },
  label: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  choices: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  choice: {
    flex: 1,
    paddingBottom: lip.sm,
  },
  lip: {
    position: 'absolute',
    top: lip.sm,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.md,
  },
  face: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    gap: space.xs,
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    paddingVertical: space.sm,
  },
  pressed: {
    transform: [{ translateY: lip.sm }],
  },
  glyph: {
    alignItems: 'center',
    height: GLYPH,
    justifyContent: 'center',
  },
  name: {
    fontFamily: serif,
    fontSize: 15,
  },
});
