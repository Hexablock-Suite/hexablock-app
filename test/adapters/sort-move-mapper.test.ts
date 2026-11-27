/** @jest-environment node */
import { SortMoveMapper } from '../../src/adapters/sort-move-mapper';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import type { HexCoord } from '../../src/domain/engine/hex-topology';
import { PlaceStack } from '../../src/domain/variants/hexa-sort/place-stack';

// Issue #405: the Sort controls send a plain intent, the pressed space. `SortMoveMapper`
// of layer 3 turns it into the `PlaceStack` of the domain, without React.

const geometry = new HexGeometry();
const topology = geometry.createTopology();
const at = (q: number, r: number) => geometry.createCoord([q, r]);

describe('SortMoveMapper', () => {
  it('should_build_the_place_stack_on_the_pressed_space_when_the_controls_send_a_sort_intent', () => {
    const move = new SortMoveMapper<HexCoord>().toMove({ at: at(0, 1) });

    expect(move.equals(PlaceStack.on(at(0, 1)), topology)).toBe(true);
    expect(move.equals(PlaceStack.on(at(1, 0)), topology)).toBe(false);
  });
});
