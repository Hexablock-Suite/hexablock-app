/** @jest-environment node */
import { SortMoveMapper } from '../../src/adapters/sort-move-mapper';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import type { HexCoord } from '../../src/domain/engine/hex-topology';
import { PlaceStack } from '../../src/domain/variants/hexa-sort/place-stack';
import { TraySlot } from '../../src/domain/variants/hexa-sort/tray-slot';

// Issue #405: the Sort controls send a plain intent. `SortMoveMapper` of layer 3 turns it into
// the `PlaceStack` of the domain, without React. Since #353 the intent also names the tray slot.

const geometry = new HexGeometry();
const topology = geometry.createTopology();
const at = (q: number, r: number) => geometry.createCoord([q, r]);

describe('SortMoveMapper', () => {
  it('should_build_the_place_stack_of_the_slot_on_the_pressed_space_when_the_controls_send_a_sort_intent', () => {
    const move = new SortMoveMapper<HexCoord>().toMove({ slot: 1, at: at(0, 1) });

    expect(move.equals(PlaceStack.on(TraySlot.of(1), at(0, 1)), topology)).toBe(true);
    expect(move.equals(PlaceStack.on(TraySlot.of(1), at(1, 0)), topology)).toBe(false);
    expect(move.equals(PlaceStack.on(TraySlot.of(0), at(0, 1)), topology)).toBe(false);
  });

  it('should_throw_a_range_error_when_the_intent_names_a_slot_below_zero', () => {
    expect(() => new SortMoveMapper<HexCoord>().toMove({ slot: -1, at: at(0, 1) })).toThrow(
      new RangeError('A tray slot needs a whole number of 0 or more, not -1.'),
    );
  });
});
