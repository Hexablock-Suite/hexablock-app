/** @jest-environment node */
import { HexGeometry } from '../../../src/domain/engine/hex-geometry';
import { HexAxis } from '../../../src/domain/engine/hex-topology';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { SquareGeometry } from '../../../src/domain/engine/square-geometry';
import { SquareAxis } from '../../../src/domain/engine/square-topology';
import { TriangleGeometry } from '../../../src/domain/engine/triangle-geometry';
import { Slide, SlideSense } from '../../../src/domain/variants/hexa-merge/slide';
import { HexLayout } from '../../../src/adapters/board/hex-layout';
import { slideWays, type SlideWay } from '../../../src/adapters/board/slide-ways';
import { SquareLayout } from '../../../src/adapters/board/square-layout';
import { TriangleLayout } from '../../../src/adapters/board/triangle-layout';

// Issue #177: the player slides the Merge tiles in each direction that the topology gives.
// `slideWays()` gives one slide per axis and sense of the topology, with the way that
// the tiles go on the screen of the figure: a compass name and an angle.
// The ways come clockwise from the north, so the screen reader reads them in that order.

const BOARD = RegionSize.of(3);

// The angle of a way in degrees, rounded to a whole degree.
function degreesOf(way: SlideWay): number {
  return Math.round((way.angle * 180) / Math.PI);
}

// True when no two ways hold equal slides.
function allDistinct(ways: readonly SlideWay[]): boolean {
  return ways.every((way, i) => ways.slice(i + 1).every((other) => !other.move.equals(way.move)));
}

describe('slideWays', () => {
  it('should_give_six_slides_clockwise_with_their_compass_names_when_the_figure_is_the_hexagon', () => {
    const ways = slideWays(new HexGeometry().createTopology(), BOARD, new HexLayout(1));

    expect(ways.map((way) => [way.compass, degreesOf(way)])).toEqual([
      ['north-east', -60],
      ['east', 0],
      ['south-east', 60],
      ['south-west', 120],
      ['west', 180],
      ['north-west', -120],
    ]);
    expect(allDistinct(ways)).toBe(true);
    // A slide forward along `q` moves the tiles toward a larger `q`: to the east of the screen.
    expect(ways[1].move.equals(Slide.of(HexAxis.q, SlideSense.forward))).toBe(true);
    expect(ways[4].move.equals(Slide.of(HexAxis.q, SlideSense.backward))).toBe(true);
  });

  it('should_give_four_slides_clockwise_with_their_compass_names_when_the_figure_is_the_square', () => {
    const ways = slideWays(new SquareGeometry().createTopology(), BOARD, new SquareLayout(1));

    expect(ways.map((way) => [way.compass, degreesOf(way)])).toEqual([
      ['north', -90],
      ['east', 0],
      ['south', 90],
      ['west', 180],
    ]);
    expect(allDistinct(ways)).toBe(true);
    expect(ways[1].move.equals(Slide.of(SquareAxis.col, SlideSense.forward))).toBe(true);
  });

  it('should_give_six_slides_with_six_compass_names_when_the_figure_is_the_triangle', () => {
    const ways = slideWays(new TriangleGeometry().createTopology(), BOARD, new TriangleLayout(1));

    expect(ways.map((way) => way.compass)).toEqual([
      'north-east',
      'east',
      'south-east',
      'south-west',
      'west',
      'north-west',
    ]);
    expect(allDistinct(ways)).toBe(true);
  });
});
