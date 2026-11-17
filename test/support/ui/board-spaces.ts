import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// Helpers that find the spaces of the board on the game screen. They exist only in test/.
// A cell renderer draws a free space with the test id `space-free` and an occupied space
// with the test id `space-occupied`. It hides each space from the screen reader,
// because the board carries the accessible name. `BoardView` places each space in a box,
// the parent of the element of the renderer. The drawing of a space takes no press,
// so a helper presses the box.

// A drawn host element, as the queries of the screen give it.
type Drawn = ReturnType<typeof screen.getByTestId>;

// The place of the box of one space.
function placeOf(space: Drawn): { left: number; top: number } {
  const style = StyleSheet.flatten(space.parent?.props.style) ?? {};
  return { left: Number(style.left), top: Number(style.top) };
}

// Every space of the board in reading order: row by row from the top, and from left to right
// in each row. Two places closer than half a point are on one row.
export function spaces(): Drawn[] {
  return screen
    .queryAllByTestId(/^space-(free|occupied)$/, { includeHiddenElements: true })
    .map((space) => ({ space, ...placeOf(space) }))
    .sort((a, b) => (Math.abs(a.top - b.top) < 0.5 ? a.left - b.left : a.top - b.top))
    .map(({ space }) => space);
}

// The positions in reading order of the spaces that a cell occupies.
export function occupiedSpaces(): number[] {
  return spaces().flatMap((space, index) =>
    space.props.testID === 'space-occupied' ? [index] : [],
  );
}

// Presses the space at `index` in reading order.
export async function pressSpace(index: number): Promise<void> {
  const space = spaces()[index];
  if (space === undefined) throw new RangeError(`The board has no space ${index}.`);
  await fireEvent.press(space.parent ?? space);
}
