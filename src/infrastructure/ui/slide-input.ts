import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { nearestWay, type ScreenWay } from '../../adapters/merge-slide-ways';

// A swipe shorter than this length in px plays nothing (issue #292, as the team prototype).
export const SWIPE_THRESHOLD = 24;

// The angle of each key on the screen, in radians from the east. The screen `y` grows down,
// so the up arrow has -90° and the down arrow 90°. Q, E, Z and C are the four diagonals
// around the W, A, S and D keys: E -60°, Q -120°, Z 120° and C 60°.
const KEY_ANGLES: ReadonlyMap<string, number> = new Map([
  ['arrowright', 0],
  ['arrowleft', Math.PI],
  ['arrowup', -Math.PI / 2],
  ['arrowdown', Math.PI / 2],
  ['e', -Math.PI / 3],
  ['q', (-2 * Math.PI) / 3],
  ['z', (2 * Math.PI) / 3],
  ['c', Math.PI / 3],
]);

// The part of a key event of the web page that the screen reads.
// `repeat` is true when the system repeats a held key. The modifier flags are true while
// the player holds Ctrl, Meta or Alt.
interface KeyPress {
  readonly key: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  preventDefault(): void;
}

type KeyListener = (press: KeyPress) => void;

// The object of the web page that gives the key events: `document`.
interface KeySource {
  addEventListener(type: 'keydown', listener: KeyListener): void;
  removeEventListener(type: 'keydown', listener: KeyListener): void;
}

// The way of a swipe that moves `dx` px to the right and `dy` px down: the way of `ways`
// nearest to the angle of the swipe. A swipe shorter than `SWIPE_THRESHOLD` gives no way.
export function swipedWay(
  ways: readonly ScreenWay[],
  dx: number,
  dy: number,
): ScreenWay | undefined {
  if (Math.hypot(dx, dy) < SWIPE_THRESHOLD) return undefined;
  return nearestWay(ways, Math.atan2(dy, dx));
}

// The key source of the screen: `document` on the web, and none on a phone.
// Only this layer reads the platform. No presenter and no use case reads it.
function keySource(): KeySource | undefined {
  if (Platform.OS !== 'web') return undefined;
  return (globalThis as { document?: KeySource }).document;
}

// Plays a slide with a key on the web (issue #292). The arrow keys and the keys Q, E, Z
// and C give the way of `ways` nearest to the angle of the key, and `play` receives it.
// A key that the system repeats plays nothing more, so a held key plays once.
// A key with Ctrl, Meta or Alt plays nothing, so a shortcut such as Ctrl+C keeps its job.
// The hook takes the key events of the whole page while the screen shows the controls.
// It listens once for each list of ways, and a ref gives the listener the latest `play`.
export function useSlideKeys(ways: readonly ScreenWay[], play: (way: ScreenWay) => void): void {
  const latestPlay = useRef(play);
  useEffect(() => {
    latestPlay.current = play;
  });
  useEffect(() => {
    const source = keySource();
    if (source === undefined) return undefined;
    const listener: KeyListener = (press) => {
      const angle = KEY_ANGLES.get(press.key.toLowerCase());
      if (angle === undefined || press.repeat || withModifier(press)) return;
      press.preventDefault();
      latestPlay.current(nearestWay(ways, angle));
    };
    source.addEventListener('keydown', listener);
    return () => source.removeEventListener('keydown', listener);
  }, [ways]);
}

// True when the player holds Ctrl, Meta or Alt with the key.
function withModifier(press: KeyPress): boolean {
  return press.ctrlKey || press.metaKey || press.altKey;
}
