import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { lip, palette, radius, serif, shadow, space } from './theme';

// A wood sign of the prototype: a wood frame with a lip and a light panel inside.
// The panel carries the text, so the text keeps its contrast on any part of the scene.
export function WoodSign({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.frame, style]}>
      <View style={styles.panel}>{children}</View>
    </View>
  );
}

// The two looks of a button: the sun-yellow main action and the light panel of a side action.
const LOOKS = {
  sun: { face: palette.sun, lip: palette.sunDeep, ink: palette.sunInk, border: palette.sun },
  panel: {
    face: palette.panel,
    lip: palette.woodLight,
    ink: palette.woodDark,
    border: palette.trim,
  },
} as const;

// A button with a face over a lip, as in the prototype. A pressed button sinks onto its lip,
// and its bounds do not change. The screen reader reads the label as the name of the button.
// A disabled button takes no press, fades, and tells the screen reader that it is disabled (#175).
export function LipButton({
  label,
  look,
  onPress,
  disabled = false,
}: {
  readonly label: string;
  readonly look: keyof typeof LOOKS;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  const colors = LOOKS[look];
  const main = look === 'sun';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space.sm}
      style={[styles.button, disabled && styles.disabled]}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.lip, { backgroundColor: colors.lip }]} />
          <View
            style={[
              styles.face,
              main ? styles.mainFace : styles.sideFace,
              { backgroundColor: colors.face, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                main ? styles.mainLabel : styles.sideLabel,
                { color: colors.ink },
              ]}
            >
              {label}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: palette.wood,
    borderRadius: radius.md,
    padding: 5,
    boxShadow: `0 ${lip.md}px 0 ${palette.woodDark}, ${shadow.soft}`,
  },
  panel: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.trim,
    borderRadius: radius.sm,
    borderWidth: 3,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  button: {
    alignSelf: 'center',
    paddingBottom: lip.md,
  },
  lip: {
    position: 'absolute',
    top: lip.md,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
  },
  face: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 3,
    justifyContent: 'center',
  },
  mainFace: {
    minHeight: 56,
    minWidth: 200,
    paddingHorizontal: space.xxl,
    boxShadow: `inset 0 3px 0 rgba(255, 255, 255, 0.35)`,
  },
  sideFace: {
    minHeight: 48,
    paddingHorizontal: space.xl,
  },
  pressed: {
    transform: [{ translateY: lip.md }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: serif,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mainLabel: {
    fontSize: 22,
  },
  sideLabel: {
    fontSize: 17,
  },
});
