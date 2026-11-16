/** @jest-environment node */
import { FitStateMapper } from '../../src/adapters/fit-state-mapper';
import { HexGeometry } from '../../src/domain/engine/hex-geometry';
import { hex, type HexCoord } from '../../src/domain/engine/hex-topology';
import { Moves } from '../../src/domain/engine/moves';
import { Piece } from '../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../src/domain/engine/shape-node';
import { FitView } from '../../src/domain/variants/hexa-fit/fit-state';
import { PieceId } from '../../src/domain/variants/hexa-fit/piece-id';

// Issue #175: `FitStateMapper` turns the cells and the payload of a Fit response into the data
// of the Fit screen (classes.md decision 14). The payload is a closed `FitView`, so the mapper
// receives its data with `deliverTo()` (#245). These tests use the hexagon topology.

const topology = new HexGeometry().createTopology();

// The keys of a list of hexagon coordinates, so a test compares coordinates by value.
const keysOf = (cells: readonly HexCoord[]) => cells.map((c) => topology.key(c));

function piece(id: string, cells: readonly HexCoord[]): Piece<PieceId, HexCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), PieceId.of(id));
}

describe('FitStateMapper', () => {
  it('should_name_the_piece_of_an_occupied_space_and_no_piece_for_a_free_space_when_it_maps_the_board', () => {
    const mapper = new FitStateMapper(topology);

    expect([
      mapper.toView(PieceId.of('a')),
      mapper.toView(PieceId.of('b')),
      mapper.freeView(),
    ]).toEqual([{ piece: 'a' }, { piece: 'b' }, {}]);
  });

  // A piece only turns, and it never mirrors (C7). A hexagon has six rotation steps:
  // each step turns (q, r) into (-r, q + r) around the origin of the piece.
  it('should_give_each_tray_piece_at_every_rotation_step_with_the_placed_pieces_and_the_move_count_when_it_maps_the_payload', () => {
    const mapper = new FitStateMapper(topology);
    const domino = piece('b', [hex(0, 0), hex(1, 0)]);
    const single = piece('c', [hex(0, 0)]);

    const payload = mapper.toPayload(new FitView([domino, single], [PieceId.of('a')], Moves.of(2)));

    const origin = topology.key(hex(0, 0));
    expect({
      ...payload,
      tray: payload.tray.map((each) => ({ piece: each.piece, turns: each.turns.map(keysOf) })),
    }).toEqual({
      tray: [
        {
          piece: 'b',
          turns: [hex(1, 0), hex(0, 1), hex(-1, 1), hex(-1, 0), hex(0, -1), hex(1, -1)].map((c) => [
            origin,
            topology.key(c),
          ]),
        },
        { piece: 'c', turns: Array.from({ length: 6 }, () => [origin]) },
      ],
      placed: ['a'],
      moves: 2,
    });
  });

  it('should_give_an_empty_tray_and_no_placed_piece_when_the_view_holds_no_piece', () => {
    const payload = new FitStateMapper(topology).toPayload(new FitView([], [], Moves.of(0)));

    expect(payload).toEqual({ tray: [], placed: [], moves: 0 });
  });
});
