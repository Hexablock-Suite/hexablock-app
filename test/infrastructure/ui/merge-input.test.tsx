import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { textCatalog } from '../../../src/adapters/texts/text-catalog';
import { GameId } from '../../../src/domain/shared/game-id';
import { TopologyId } from '../../../src/domain/shared/topology-id';
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { SquareGeometry } from '../../../src/domain/engine/square-geometry';
import { HexLayout } from '../../../src/adapters/board/hex-layout';
import type { MergeIntent } from '../../../src/adapters/merge-move-mapper';
import { slideWays, type Compass, type SlideWay } from '../../../src/adapters/merge-slide-ways';
import { SquareLayout } from '../../../src/adapters/board/square-layout';
import { CompositionRoot } from '../../../src/infrastructure/composition-root';
import { gameSessionOf, type GameSession } from '../../../src/infrastructure/ui/game-session';
import { GameStage } from '../../../src/infrastructure/ui/game-stage';
import { RecordingLogger } from '../../support/application/recording-logger';
import { ManualClock } from '../../support/engine/manual-clock';

// Issue #292: the player slides the Merge tiles with a swipe anywhere on the board, and on
// the web with the arrow keys and the keys Q, E, Z and C. A swipe or a key plays the way
// whose angle on the screen is nearest to its own angle, so each figure gets its own ways
// with no branch on the figure. A swipe shorter than 24 px plays nothing, and a key that
// the system repeats plays once. The ring of slide buttons stays for the screen reader.

// A safe area with no insets, as a phone without a notch gives it.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// The length of a swipe well past the threshold.
const LONG = 80;

// The two figures of Merge with a slide in every way of the screen: the hexagon and the square.
// The ways come from the topology and the layout of each figure, as the registry gives them.
const FIGURES = [
  {
    figure: TopologyId.hex,
    ways: slideWays(new HexGeometry().createTopology(), RegionSize.of(3), new HexLayout(1)),
  },
  {
    figure: TopologyId.square,
    ways: slideWays(new SquareGeometry().createTopology(), RegionSize.of(3), new SquareLayout(1)),
  },
];

// The way nearest to each key on the hexagon and on the square. Up and down fall between
// two ways of the hexagon, and the first of them clockwise from the north wins.
const KEY_WAYS: readonly (readonly [string, Compass, Compass])[] = [
  ['ArrowRight', 'east', 'east'],
  ['ArrowLeft', 'west', 'west'],
  ['ArrowUp', 'north-east', 'north'],
  ['ArrowDown', 'south-east', 'south'],
  ['e', 'north-east', 'north'],
  ['q', 'north-west', 'north'],
  ['z', 'south-west', 'south'],
  ['c', 'south-east', 'south'],
];

// The Merge session of the real composition root on `figure`, with a manual clock.
function mergeSession(figure: TopologyId): GameSession {
  const root = new CompositionRoot({ clock: new ManualClock(), logger: new RecordingLogger() });
  return gameSessionOf(root, GameId.of('hexa-merge'), textCatalog.es, figure);
}

async function show(session: GameSession): Promise<void> {
  await render(
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={METRICS}>
        <GameStage title="Hexa Merge" {...session} onBack={jest.fn()} />
      </SafeAreaProvider>
    </GestureHandlerRootView>,
  );
  await screen.findByText('En juego');
}

// Records each intent that the controls give to the presenter, and lets the presenter play it.
function recordMoves(session: GameSession): jest.SpyInstance {
  return jest.spyOn(session.presenter, 'onMove');
}

// The compass names of the intents that the presenter received, in order (#405).
function playedOf(spy: jest.SpyInstance): Compass[] {
  return spy.mock.calls.map(([intent]) => (intent as MergeIntent).toward);
}

// True when `played` names the ways of `expected`, in the same order. The move mapper of
// the session gives the slide of each way, and its own test checks it.
function sameSlides(played: readonly Compass[], expected: readonly SlideWay[]): boolean {
  return (
    played.length === expected.length && played.every((toward, i) => toward === expected[i].compass)
  );
}

// Swipes `length` px on the board at `angle` radians from the east, clockwise on the screen.
async function swipe(angle: number, length: number): Promise<void> {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('merge-swipe'), [
      { translationX: length * Math.cos(angle), translationY: length * Math.sin(angle) },
    ]);
  });
}

// The key source of a web page: the screen listens on `document` for a key down.
const keys = new EventTarget();
const host = globalThis as { document?: unknown };

// The modifier keys that a key event can hold.
interface Modifiers {
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
}

// Presses the key `key` on the web page. `repeat` says that the system repeats a held key,
// and `modifiers` says which modifier keys the player holds.
async function press(key: string, repeat = false, modifiers: Modifiers = {}): Promise<void> {
  const event = { key, repeat, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
  await act(async () => {
    keys.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), event));
  });
}

// The way of `ways` with the compass name `compass`.
function wayOf(ways: readonly SlideWay[], compass: Compass): SlideWay {
  const way = ways.find((each) => each.compass === compass);
  if (way === undefined) throw new Error(`No way ${compass}`);
  return way;
}

describe('Merge input', () => {
  afterEach(() => {
    delete host.document;
    jest.restoreAllMocks();
  });

  it('should_play_the_slide_of_each_way_when_the_player_swipes_that_way_on_the_hexagon_and_on_the_square', async () => {
    for (const { figure, ways } of FIGURES) {
      const session = mergeSession(figure);
      await show(session);
      const moves = recordMoves(session);

      for (const way of ways) await swipe(way.angle, LONG);

      expect(ways).toHaveLength(figure === TopologyId.hex ? 6 : 4);
      expect(sameSlides(playedOf(moves), ways)).toBe(true);
      await screen.unmount();
    }
  });

  it('should_play_nothing_when_the_swipe_is_shorter_than_24_px', async () => {
    const [{ figure, ways }] = FIGURES;
    const session = mergeSession(figure);
    await show(session);
    const moves = recordMoves(session);
    const before = session.presenter.viewModel();

    for (const way of ways) await swipe(way.angle, 23.9);
    const short = moves.mock.calls.length;
    const afterShort = session.presenter.viewModel();
    await swipe(wayOf(ways, 'east').angle, 24);

    expect(short).toBe(0);
    expect(afterShort).toBe(before);
    expect(sameSlides(playedOf(moves), [wayOf(ways, 'east')])).toBe(true);
  });

  it('should_play_the_way_nearest_to_the_angle_of_each_key_when_the_player_presses_the_eight_keys_on_the_web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    host.document = keys;
    for (const [index, { figure, ways }] of FIGURES.entries()) {
      const session = mergeSession(figure);
      await show(session);
      const moves = recordMoves(session);

      for (const [key] of KEY_WAYS) await press(key);

      const expected = KEY_WAYS.map((row) => wayOf(ways, index === 0 ? row[1] : row[2]));
      expect(sameSlides(playedOf(moves), expected)).toBe(true);
      await screen.unmount();
    }
  });

  it('should_play_once_when_the_system_repeats_a_held_key_on_the_web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    host.document = keys;
    const [{ figure, ways }] = FIGURES;
    const session = mergeSession(figure);
    await show(session);
    const moves = recordMoves(session);

    await press('ArrowRight');
    await press('ArrowRight', true);
    await press('ArrowRight', true);
    await press('Enter');

    expect(sameSlides(playedOf(moves), [wayOf(ways, 'east')])).toBe(true);
  });

  it('should_play_nothing_when_the_player_holds_ctrl_meta_or_alt_with_a_key_on_the_web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    host.document = keys;
    const [{ figure, ways }] = FIGURES;
    const session = mergeSession(figure);
    await show(session);
    const moves = recordMoves(session);

    await press('c', false, { ctrlKey: true });
    await press('e', false, { metaKey: true });
    await press('ArrowLeft', false, { altKey: true });
    const withModifier = moves.mock.calls.length;
    await press('ArrowRight');

    expect(withModifier).toBe(0);
    expect(sameSlides(playedOf(moves), [wayOf(ways, 'east')])).toBe(true);
  });

  it('should_play_nothing_when_the_player_presses_a_key_off_the_web', async () => {
    host.document = keys;
    const [{ figure }] = FIGURES;
    const session = mergeSession(figure);
    await show(session);
    const moves = recordMoves(session);

    for (const [key] of KEY_WAYS) await press(key);

    expect(Platform.OS).not.toBe('web');
    expect(moves).not.toHaveBeenCalled();
  });

  it('should_take_a_press_as_a_press_not_a_swipe_when_it_starts_on_a_slide_or_undo_button', async () => {
    const [{ figure, ways }] = FIGURES;
    const session = mergeSession(figure);
    await show(session);
    const moves = recordMoves(session);
    const area = screen.getByTestId('merge-swipe-area');

    await fireEvent.press(screen.getByRole('button', { name: 'Deslizar al oeste' }));

    // The swipe area holds the board only, so a press on a button never starts a swipe.
    expect(within(area).queryAllByRole('button')).toEqual([]);
    expect(screen.getAllByRole('button', { name: /^Deslizar al / })).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeOnTheScreen();
    expect(sameSlides(playedOf(moves), [wayOf(ways, 'west')])).toBe(true);
  });
});
