import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MergeCellView, MergePayloadView } from '../../adapters/merge-state-mapper';
import type { Texts } from '../../adapters/texts/text-catalog';
import type { GridAxis } from '../../domain/engine/grid-topology';
import type { Slide } from '../../domain/variants/hexa-merge/slide';
import type { SlideWay } from '../board/slide-ways';
import { Hexagon, HexStone } from './hex-stone';
import type { MoveControls, MoveControlsProps } from './move-controls';
import { lip, palette, radius, serif, space } from './theme';
import { LipButton, WoodSign } from './wood';

type MergeProps<TCoord> = MoveControlsProps<
  TCoord,
  MergeCellView,
  MergePayloadView,
  Slide<GridAxis>
>;

// A slide button: a round face wide enough for a finger, over its lip.
const BUTTON = 48;
// The room between two neighbor buttons of the ring.
const GAP = space.sm;
// The wood hexagon at the center of the ring.
const HUB = 22;

// The handler of the Merge board: a slide moves every tile, so a press on a space plays nothing.
function ignoreSpace(): void {}

// The move controls of Hexa Merge (classes.md decision 14, issue #177). The game registry
// of the composition root chooses them for Merge, with the slides of the board figure.
// Below the board, one button for each slide sits on a ring around a wood hexagon, at the angle
// of its way on the screen: six on the hexagon, four on the square. Each button names its way
// and plays its `Slide` through `GamePresenter.onMove()`.
// When the payload says that a merge made the target tile, a prompt over the screen offers
// to continue, as in 2048 (A3). The rules never answer a victory for Merge, so the prompt
// reads the flag of the payload, not the outcome. The flag stays true, so the prompt opens
// once: after the player continues, it stays closed.
export class MergeControls<TCoord> implements MoveControls<
  TCoord,
  MergeCellView,
  MergePayloadView,
  Slide<GridAxis>
> {
  constructor(private readonly ways: readonly SlideWay[]) {}

  render(props: MergeProps<TCoord>): ReactNode {
    return <MergePlay ways={this.ways} {...props} />;
  }
}

// The board, the ring of slide buttons and the prompt of the target tile.
function MergePlay<TCoord>({
  ways,
  model,
  texts,
  play,
  board,
}: MergeProps<TCoord> & { readonly ways: readonly SlideWay[] }) {
  const [continued, setContinued] = useState(false);
  const ring = ringOf(ways);
  return (
    <>
      {board(ignoreSpace)}
      <View style={[styles.pad, { width: ring.width, height: ring.height }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.hub, { left: ring.hub.x - HUB / 2, top: ring.hub.y - HUB / 2 }]}
        >
          <Hexagon size={HUB} color={palette.wood} />
        </View>
        {ring.places.map(({ way, left, top }) => (
          <SlideButton
            key={way.compass}
            label={texts[`play.merge.slide.${way.compass}`]}
            angle={way.angle}
            left={left}
            top={top}
            onPress={() => play(way.move)}
          />
        ))}
      </View>
      <TargetPrompt
        visible={model.payload?.targetReached === true && !continued}
        texts={texts}
        onContinue={() => setContinued(true)}
      />
    </>
  );
}

interface Ring {
  readonly width: number;
  readonly height: number;
  readonly hub: { readonly x: number; readonly y: number };
  readonly places: readonly {
    readonly way: SlideWay;
    readonly left: number;
    readonly top: number;
  }[];
}

// The places of the buttons on the ring, inside the smallest box that holds them.
// The radius keeps a gap between two neighbor buttons and around the hub.
function ringOf(ways: readonly SlideWay[]): Ring {
  const turns = ways.map((way) => way.angle).sort((a, b) => a - b);
  const steps = turns.map((angle, i) => (turns[i + 1] ?? turns[0] + 2 * Math.PI) - angle);
  const narrowest = Math.min(Math.PI, ...steps);
  const reach = Math.max((BUTTON + GAP) / (2 * Math.sin(narrowest / 2)), (BUTTON + HUB) / 2 + GAP);
  const centers = ways.map((way) => ({
    way,
    x: reach * Math.cos(way.angle),
    y: reach * Math.sin(way.angle),
  }));
  const left = Math.min(...centers.map(({ x }) => x)) - BUTTON / 2;
  const top = Math.min(...centers.map(({ y }) => y)) - BUTTON / 2;
  const right = Math.max(...centers.map(({ x }) => x)) + BUTTON / 2;
  const bottom = Math.max(...centers.map(({ y }) => y)) + BUTTON / 2 + lip.sm;
  return {
    width: right - left,
    height: bottom - top,
    hub: { x: -left, y: -top },
    places: centers.map(({ way, x, y }) => ({
      way,
      left: x - BUTTON / 2 - left,
      top: y - BUTTON / 2 - top,
    })),
  };
}

interface SlideButtonProps {
  readonly label: string;
  readonly angle: number;
  readonly left: number;
  readonly top: number;
  readonly onPress: () => void;
}

// One slide button: a light face with a chevron that points along the way, over a wood lip.
// A pressed button sinks onto its lip, and its bounds do not change. The screen reader reads
// the label, for example «Deslizar al este».
function SlideButton({ label, angle, left, top, onPress }: SlideButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.xs}
      onPress={onPress}
      style={[styles.slide, { left, top }]}
    >
      {({ pressed }) => (
        <>
          <View style={styles.slideLip} />
          <View style={[styles.slideFace, pressed && styles.pressed]}>
            <View style={[styles.chevron, { transform: [{ rotate: `${angle}rad` }] }]}>
              <View style={[styles.arm, styles.upperArm]} />
              <View style={[styles.arm, styles.lowerArm]} />
            </View>
          </View>
        </>
      )}
    </Pressable>
  );
}

interface TargetPromptProps {
  readonly visible: boolean;
  readonly texts: Texts;
  readonly onContinue: () => void;
}

// The prompt of the target tile: a wood sign over a veil, with a sun stone, a title,
// one line and the button that continues the game. The back gesture of the system continues too.
function TargetPrompt({ visible, texts, onContinue }: TargetPromptProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onContinue}
    >
      <View style={styles.scrim}>
        <WoodSign style={styles.promptSign}>
          <View accessibilityViewIsModal style={styles.prompt}>
            <HexStone size={56} colors={{ tone: palette.sun, wash: palette.white }} />
            <Text accessibilityRole="header" style={styles.promptTitle}>
              {texts['play.merge.target.title']}
            </Text>
            <Text style={styles.promptBody}>{texts['play.merge.target.body']}</Text>
            <LipButton
              label={texts['play.merge.target.continue']}
              look="sun"
              onPress={onContinue}
            />
          </View>
        </WoodSign>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pad: {
    alignSelf: 'center',
    marginBottom: space.md,
  },
  hub: {
    position: 'absolute',
  },
  slide: {
    position: 'absolute',
    width: BUTTON,
    height: BUTTON + lip.sm,
  },
  slideLip: {
    position: 'absolute',
    top: lip.sm,
    left: 0,
    width: BUTTON,
    height: BUTTON,
    borderRadius: radius.pill,
    backgroundColor: palette.woodLight,
  },
  slideFace: {
    width: BUTTON,
    height: BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: palette.trim,
    backgroundColor: palette.panel,
  },
  pressed: {
    transform: [{ translateY: lip.sm }],
  },
  // A chevron of two arms that points east in a box of 20. The arms meet at the right.
  chevron: {
    width: 20,
    height: 20,
  },
  arm: {
    position: 'absolute',
    left: 4,
    width: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.woodDark,
  },
  upperArm: {
    top: 4.5,
    transform: [{ rotate: '45deg' }],
  },
  lowerArm: {
    top: 11.5,
    transform: [{ rotate: '-45deg' }],
  },
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: palette.scrim,
  },
  promptSign: {
    width: '100%',
    maxWidth: 360,
  },
  prompt: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  promptTitle: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 26,
    textAlign: 'center',
  },
  promptBody: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
});
