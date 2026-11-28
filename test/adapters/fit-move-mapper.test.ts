/** @jest-environment node */
import { FitMoveMapper } from '../../src/adapters/fit-move-mapper';
import { HexGeometry } from '../../src/domain/engine/geometry/hex-geometry';
import type { HexCoord } from '../../src/domain/engine/geometry/hex-topology';
import { Turns } from '../../src/domain/engine/geometry/turns';
import { PlaceFitPiece, RemoveFitPiece } from '../../src/domain/variants/hexa-fit/fit-move';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';

// Issue #405: the Fit controls send a plain intent: the text id of a piece, a rotation step
// as a number and the pressed space. `FitMoveMapper` of layer 3 turns the text into a
// `PieceId` and the number into `Turns`, and builds the Fit move, without React.

const geometry = new HexGeometry();
const topology = geometry.createTopology();
const at = (q: number, r: number) => geometry.createCoord([q, r]);

describe('FitMoveMapper', () => {
  it('should_build_the_place_fit_piece_of_the_piece_rotation_and_space_when_the_controls_send_a_place_intent', () => {
    const move = new FitMoveMapper<HexCoord>().toMove({
      kind: 'place',
      piece: 'a',
      rotation: 2,
      at: at(1, 0),
    });

    const expected = new PlaceFitPiece(PieceId.of('a'), Turns.of(2), at(1, 0));
    const otherTurn = new PlaceFitPiece(PieceId.of('a'), Turns.of(1), at(1, 0));
    expect(move.equals(expected, topology)).toBe(true);
    expect(move.equals(otherTurn, topology)).toBe(false);
  });

  it('should_place_the_origin_at_the_offset_of_the_figure_step_when_the_figure_gives_a_step', () => {
    const asked: [HexCoord, boolean][] = [];
    const mapper = new FitMoveMapper<HexCoord>((space, rotation) => {
      asked.push([space, rotation.equals(Turns.of(3))]);
      return at(-1, 0);
    });

    const move = mapper.toMove({ kind: 'place', piece: 'b', rotation: 3, at: at(2, -1) });

    const expected = new PlaceFitPiece(PieceId.of('b'), Turns.of(3), at(-1, 0));
    expect(move.equals(expected, topology)).toBe(true);
    expect(
      asked.map(([space, turn]) => [topology.key(space).equals(topology.key(at(2, -1))), turn]),
    ).toEqual([[true, true]]);
  });

  it('should_build_the_remove_fit_piece_of_the_piece_when_the_controls_send_a_remove_intent', () => {
    const move = new FitMoveMapper<HexCoord>().toMove({ kind: 'remove', piece: 'c' });

    expect(move.equals(new RemoveFitPiece(PieceId.of('c')), topology)).toBe(true);
    expect(move.equals(new RemoveFitPiece(PieceId.of('a')), topology)).toBe(false);
  });
});
