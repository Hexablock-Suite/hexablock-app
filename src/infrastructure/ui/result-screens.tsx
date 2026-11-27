import type { ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import type { ResultViewModel } from '../../adapters/result-presenter';
import { HexStone } from './hex-stone';
import { palette, serif, space } from './theme';
import { LipButton, WoodSign } from './wood';

// The victory screen (issue #180, APP-FR-07), the MVP view of `ResultPresenter` for a won game.
// It opens over the game screen when the presenter shows a victory. It shows the title, the final
// score and the text of a failed save. It offers the next level of a won level (Fit, Sort) or a
// new game of a game with no levels (Lines, Merge), when the view model has one, and the way back
// to the map. Every visible text comes from the view model, which reads the text catalog
// (APP-FR-11). The back gesture of the system goes back to the map.
// When the backend refused the token of the sync after the save (#46), both screens show the
// request to sign in and a button that calls `onSignIn`.
export function VictoryScreen({
  model,
  onNext,
  onNewGame,
  onBack,
  onSignIn,
}: {
  readonly model: ResultViewModel;
  // Opens the level whose text is `levelId`.
  readonly onNext: (levelId: string) => void;
  readonly onNewGame: () => void;
  readonly onBack: () => void;
  // Opens the account screen.
  readonly onSignIn: () => void;
}) {
  const { next, newGame } = model;
  return (
    <ResultSign model={model} stone={palette.sun} onBack={onBack} onSignIn={onSignIn}>
      {next === undefined ? null : (
        <LipButton label={next.label} look="sun" onPress={() => onNext(next.levelId)} />
      )}
      {newGame === undefined ? null : <LipButton label={newGame} look="sun" onPress={onNewGame} />}
    </ResultSign>
  );
}

// The defeat screen (issue #180, APP-FR-07), the MVP view of `ResultPresenter` for a lost game.
// It opens over the game screen when the presenter shows a defeat. It shows the title, the final
// score and the text of a failed save, and it offers a retry and the way back to the map.
export function DefeatScreen({
  model,
  onRetry,
  onBack,
  onSignIn,
}: {
  readonly model: ResultViewModel;
  readonly onRetry: () => void;
  readonly onBack: () => void;
  // Opens the account screen.
  readonly onSignIn: () => void;
}) {
  return (
    <ResultSign model={model} stone={palette.woodLight} onBack={onBack} onSignIn={onSignIn}>
      {model.retry === undefined ? null : (
        <LipButton label={model.retry} look="sun" onPress={onRetry} />
      )}
    </ResultSign>
  );
}

// The part that both screens share: a wood sign over a veil with a stone of the color `stone`,
// the title, the final score, the text of a failed save, the request to sign in, the buttons of
// the screen and the way back to the map.
function ResultSign({
  model,
  stone,
  onBack,
  onSignIn,
  children,
}: {
  readonly model: ResultViewModel;
  readonly stone: string;
  readonly onBack: () => void;
  readonly onSignIn: () => void;
  readonly children: ReactNode;
}) {
  const { signIn } = model;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onBack}>
      <View style={styles.scrim}>
        <WoodSign style={styles.sign}>
          <View accessibilityViewIsModal style={styles.content}>
            <HexStone size={56} colors={{ tone: stone, wash: palette.white }} />
            <Text accessibilityRole="header" style={styles.title}>
              {model.title}
            </Text>
            <View accessible style={styles.score}>
              <Text style={styles.scoreLabel}>{model.scoreLabel}</Text>
              <Text style={styles.scoreValue}>{model.score}</Text>
            </View>
            {model.error === undefined ? null : (
              <Text accessibilityRole="alert" style={styles.error}>
                {model.error}
              </Text>
            )}
            {signIn === undefined ? null : (
              <>
                <Text accessibilityRole="alert" style={styles.error}>
                  {signIn.text}
                </Text>
                <LipButton label={signIn.label} look="panel" onPress={onSignIn} />
              </>
            )}
            {children}
            <LipButton label={model.back} look="panel" onPress={onBack} />
          </View>
        </WoodSign>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: palette.scrim,
  },
  sign: {
    width: '100%',
    maxWidth: 360,
  },
  content: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  title: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 26,
    textAlign: 'center',
  },
  score: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  scoreLabel: {
    color: palette.inkMuted,
    fontFamily: serif,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  scoreValue: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: palette.ribbonDeep,
    fontFamily: serif,
    fontSize: 16,
    textAlign: 'center',
  },
});
