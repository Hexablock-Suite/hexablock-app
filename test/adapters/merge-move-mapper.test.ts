/** @jest-environment node */
import { HexLayout } from '../../src/adapters/board/hex-layout';
import { SquareLayout } from '../../src/adapters/board/square-layout';
import { MergeMoveMapper } from '../../src/adapters/merge-move-mapper';
import { slideWays } from '../../src/adapters/merge-slide-ways';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import { RegionSize } from '../../src/domain/engine/region-size';
import { SquareGeometry } from '../../src/domain/engine/square-geometry';

// Issue #405: the Merge controls send a plain intent, the compass name of a way on the screen.
// `MergeMoveMapper` of layer 3 keeps the slide ways of the board figure and gives the `Slide`
// of that way, without React. So no control names `Slide`.

const HEX_WAYS = slideWays(new HexGeometry().createTopology(), RegionSize.of(3), new HexLayout(1));
const SQUARE_WAYS = slideWays(
  new SquareGeometry().createTopology(),
  RegionSize.of(3),
  new SquareLayout(1),
);

describe('MergeMoveMapper', () => {
  it('should_give_the_slide_of_the_way_with_that_compass_name_when_the_controls_send_a_merge_intent', () => {
    const mapper = new MergeMoveMapper(HEX_WAYS);

    const matches = HEX_WAYS.map((way) =>
      HEX_WAYS.map((other) => mapper.toMove({ toward: way.compass }).equals(other.move)),
    );

    expect(HEX_WAYS).toHaveLength(6);
    expect(matches).toEqual(HEX_WAYS.map((_, i) => HEX_WAYS.map((_other, j) => i === j)));
  });

  it('should_throw_a_range_error_when_the_intent_names_a_way_that_the_figure_does_not_have', () => {
    const mapper = new MergeMoveMapper(SQUARE_WAYS);

    expect(SQUARE_WAYS.map((way) => way.compass)).not.toContain('north-east');
    expect(() => mapper.toMove({ toward: 'north-east' })).toThrow(RangeError);
  });
});
