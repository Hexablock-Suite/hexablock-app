import { CoordKeyMap } from '../domain/engine/geometry/coord-key-map';
import type { GridAxis, GridTopology } from '../domain/engine/geometry/grid-topology';
import type { RegionSize } from '../domain/engine/geometry/region-size';
import { Slide, SlideSense } from '../domain/variants/hexa-merge/slide';
import type { BoardLayout } from './board/board-layout';

// The eight compass names of a way on the screen, counterclockwise from the east.
// The text catalog names each one under `play.merge.slide.<name>`.
const COMPASS = [
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
  'south',
  'south-east',
] as const;

export type Compass = (typeof COMPASS)[number];

// One way that the tiles of a Merge board go on the screen (issue #177).
// `angle` is the angle of the way in radians, from the east. The screen `y` grows down,
// so a positive angle turns clockwise, as a CSS rotation does. `compass` is the nearest
// of the eight compass names. The move controls read only these two fields, so they name
// no class of the variant (issue #405).
export interface ScreenWay {
  readonly compass: Compass;
  readonly angle: number;
}

// One slide of Hexa Merge with its way on the screen (issue #177). `MergeMoveMapper` keeps
// these pairs and gives the slide of a way (issue #405).
export interface SlideWay extends ScreenWay {
  readonly move: Slide<GridAxis>;
}

// The slides of a Merge board of the region `size` on `topology`: one for each axis and sense,
// with its way on the screen of `layout` (issue #177). A hexagon gives six, a square four.
// The way of a slide goes from the last cell to the first cell of its longest line, in the order
// of `Slide.fromLeadingEdge()`. So the screen side asks the slide and the topology,
// and it names no axis. The ways come clockwise from the north, the order of the screen reader.
export function slideWays<TCoord>(
  topology: GridTopology<TCoord>,
  size: RegionSize,
  layout: BoardLayout<TCoord>,
): SlideWay[] {
  const cells = topology.region(size).coordinates();
  // A key is a value object, so the map finds a cell by an equal key (issue #246).
  const region = new CoordKeyMap<TCoord>();
  for (const c of cells) region.set(topology.key(c), c);
  const board = {
    line: (axis: GridAxis, through: TCoord) =>
      topology.line(axis, through, (c) => region.has(topology.key(c))),
  };
  return topology
    .axes()
    .flatMap((axis) => SlideSense.all.map((toward) => Slide.of(axis, toward)))
    .map((move) => {
      const longest = cells
        .map((c) => [...move.lineThrough(board, c)])
        .reduce((best, line) => (line.length > best.length ? line : best));
      const ordered = move.fromLeadingEdge(longest);
      const lead = layout.centerOf(ordered[0]);
      const tail = layout.centerOf(ordered[ordered.length - 1]);
      const angle = Math.atan2(lead.y - tail.y, lead.x - tail.x);
      return { move, compass: compassOf(angle), angle };
    })
    .sort((a, b) => clockwiseFromNorth(a.angle) - clockwiseFromNorth(b.angle));
}

// The nearest compass name of `angle`. The compass turns counterclockwise, and the screen
// angle turns clockwise, so the step count takes the other sign.
function compassOf(angle: number): Compass {
  const steps = Math.round(-angle / (Math.PI / 4));
  return COMPASS[((steps % COMPASS.length) + COMPASS.length) % COMPASS.length];
}

// The angle in whole degrees, clockwise from the north: 0 for the north, 90 for the east.
function clockwiseFromNorth(angle: number): number {
  const degrees = Math.round((angle * 180) / Math.PI) + 90;
  return ((degrees % 360) + 360) % 360;
}

// Two gaps closer than this count as equal, so a rounding error never breaks a tie.
const TIE = 1e-9;

// The way of `ways` whose angle is nearest to `angle`, in radians from the east (issue #292).
// A swipe and a key give their angle, and each figure answers with its own ways, so the
// function holds no branch on the figure. When two ways are equally near, the first of them
// wins, in the order of `slideWays()`: clockwise from the north.
export function nearestWay<TWay extends ScreenWay>(ways: readonly TWay[], angle: number): TWay {
  const gaps = ways.map((way) => angleBetween(way.angle, angle));
  const nearest = Math.min(...gaps);
  return ways[gaps.findIndex((gap) => gap - nearest < TIE)];
}

// The smallest turn from `a` to `b`, in radians from 0 to π.
function angleBetween(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
}
