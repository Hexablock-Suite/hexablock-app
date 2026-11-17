import type { screen } from '@testing-library/react-native';

// Helpers that read the outlines that a cell renderer draws. They exist only in test/.
// A renderer draws each outline as an SVG polygon. React Native SVG turns a polygon into
// a path with the data `M x y x y … z`, so a helper reads the corners from that data.

// A drawn host element, as the queries of the screen give it.
type Drawn = ReturnType<typeof screen.getByTestId>;

// One drawn outline: the count of its corners and the way that it points.
// `up` and `down` name a triangle with one corner at the top or at the bottom.
// `pointy` names a shape with one corner at the top, and `flat` a shape with a top side.
export interface Outline {
  readonly corners: number;
  readonly points: 'up' | 'down' | 'pointy' | 'flat';
}

// Two values closer than this are equal.
const CLOSE = 1e-6;

// The corners of the path data `d`.
function cornersOf(d: string): { x: number; y: number }[] {
  const values = (d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) ?? []).map(Number);
  const corners: { x: number; y: number }[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    corners.push({ x: values[index], y: values[index + 1] });
  }
  return corners;
}

// The way that the corners `corners` point.
function wayOf(corners: readonly { x: number; y: number }[]): Outline['points'] {
  const ys = corners.map(({ y }) => y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const atTop = ys.filter((y) => Math.abs(y - top) < CLOSE).length;
  const atBottom = ys.filter((y) => Math.abs(y - bottom) < CLOSE).length;
  if (corners.length === 3) return atTop === 1 && atBottom === 2 ? 'up' : 'down';
  return atTop === 1 ? 'pointy' : 'flat';
}

// Every element below `element`, `element` included.
function descendants(element: Drawn): Drawn[] {
  const children = (element.children ?? []).filter(
    (child): child is Drawn => typeof child !== 'string',
  );
  return [element, ...children.flatMap(descendants)];
}

// The outlines that `element` draws, in the order of the tree.
export function outlinesIn(element: Drawn): Outline[] {
  return descendants(element)
    .map((each) => each.props.d)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .map(cornersOf)
    .map((corners) => ({ corners: corners.length, points: wayOf(corners) }));
}
