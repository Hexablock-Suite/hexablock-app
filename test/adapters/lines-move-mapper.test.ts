/** @jest-environment node */
import { LinesMoveMapper } from '../../src/adapters/lines-move-mapper';
import { HexGeometry } from '../../src/domain/engine/geometry/hex-geometry';
import type { HexCoord } from '../../src/domain/engine/geometry/hex-topology';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../src/domain/variants/hexa-lines/tray-position';

// Issue #405: the Lines controls send a plain intent, the tray position and the pressed space.
// `LinesMoveMapper` of layer 3 turns it into the `PlacePiece` of the domain, without React.

const geometry = new HexGeometry();
const topology = geometry.createTopology();
const at = (q: number, r: number) => geometry.createCoord([q, r]);

describe('LinesMoveMapper', () => {
  it('should_build_the_place_piece_of_the_tray_position_on_the_pressed_space_when_the_controls_send_a_lines_intent', () => {
    const move = new LinesMoveMapper<HexCoord>().toMove({ position: 2, at: at(1, -1) });

    expect(move.equals(new PlacePiece(TrayPosition.of(2), at(1, -1)), topology)).toBe(true);
    expect(move.equals(new PlacePiece(TrayPosition.of(1), at(1, -1)), topology)).toBe(false);
  });

  it('should_place_the_piece_at_the_offset_of_the_figure_step_when_the_figure_gives_a_step', () => {
    const pressed: HexCoord[] = [];
    const mapper = new LinesMoveMapper<HexCoord>((space) => {
      pressed.push(space);
      return at(0, 0);
    });

    const move = mapper.toMove({ position: 0, at: at(2, 0) });

    expect(move.equals(new PlacePiece(TrayPosition.of(0), at(0, 0)), topology)).toBe(true);
    expect(pressed.map((space) => topology.key(space).equals(topology.key(at(2, 0))))).toEqual([
      true,
    ]);
  });
});
