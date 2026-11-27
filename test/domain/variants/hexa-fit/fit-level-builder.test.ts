/** @jest-environment node */
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { ElapsedTime } from '../../../../src/domain/shared/elapsed-time';
import { TopologyId } from '../../../../src/domain/shared/topology-id';
import { HexGeometry } from '../../../../src/domain/engine/hex-geometry';
import { hex, HexTopology, type HexCoord } from '../../../../src/domain/engine/hex-topology';
import { LevelDefinition } from '../../../../src/domain/progress/level-definition';
import { Moves } from '../../../../src/domain/shared/moves';
import { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { square, SquareTopology } from '../../../../src/domain/engine/square-topology';
import { FitLevel } from '../../../../src/domain/variants/hexa-fit/fit-level';
import { FitLevelBuilder } from '../../../../src/domain/variants/hexa-fit/fit-level-builder';
import { FitStarThreshold } from '../../../../src/domain/variants/hexa-fit/fit-stars';
import { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { fitLevelFile } from '../../../support/variants/hexa-fit/fit-level-file';

// The Fit level builder builds a `FitLevel` from a level file (issue #166, classes.md decision 15).
// `LevelDefinition` directs it, and it turns each coordinate of the file into a `TCoord`
// through its geometry. `build()` checks A5 and creates the level through `FitLevel.of()`.

type FitFile = ReturnType<typeof fitLevelFile>;

const hexGeometry = new HexGeometry();

// The level that the hex Fit builder builds from `file`.
function built(file: Parameters<typeof LevelDefinition.of>[0]): FitLevel<HexCoord> {
  return LevelDefinition.of(file).buildWith(new FitLevelBuilder(hexGeometry));
}

// The file of the format example with the section that `change` gives.
function withSection(change: (section: FitFile['section']) => unknown) {
  const file = fitLevelFile();
  return { ...file, section: change(file.section) };
}

function fitPiece(id: string, cells: readonly HexCoord[]): Piece<PieceId, HexCoord> {
  return new Piece(new ShapeGroup(cells.map((c) => new CellNode(c))), PieceId.of(id));
}

function star(maxMoves: number, maxElapsedMs: number): FitStarThreshold {
  return FitStarThreshold.of({
    maxMoves: Moves.of(maxMoves),
    maxElapsedMs: ElapsedTime.ofMs(maxElapsedMs),
  });
}

const UNEQUAL_AREA = 'The pieces of a Fit level do not have the area of its figure.';
const INEXACT_WITNESS = 'The witness of a Fit level does not cover its figure exactly.';

describe('FitLevelBuilder', () => {
  it('should_build_the_level_of_the_file_when_the_definition_directs_the_builder', () => {
    const level = built(fitLevelFile());

    const expected = FitLevel.of(
      TopologyId.hex,
      BoardShape.of([hex(0, 0), hex(1, 0), hex(2, 0), hex(0, 1), hex(1, 1), hex(2, 1)]),
      [
        fitPiece('a', [hex(0, 0), hex(1, 0), hex(0, 1)]),
        fitPiece('b', [hex(0, 0), hex(1, 0)]),
        fitPiece('c', [hex(0, 0)]),
      ],
      [star(12, 120000), star(8, 60000), star(4, 30000)],
    );
    expect(level.equals(expected, new HexTopology())).toBe(true);
    expect(level.runsOn(hexGeometry)).toBe(true);
  });

  // The builder reads the coordinates through the geometry of the level topology,
  // so the same builder class builds a square level (APP-FR-16).
  it('should_turn_each_coordinate_through_its_geometry_when_the_level_is_square', () => {
    const file = {
      levelId: 'fit-square-01',
      order: 1,
      topology: 'square',
      section: {
        figure: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        pieces: [
          {
            id: 'a',
            cells: [
              [0, 0],
              [1, 0],
            ],
          },
          {
            id: 'b',
            cells: [
              [0, 0],
              [1, 0],
            ],
          },
        ],
        // One step of a square is a quarter turn. A negative count turns the other way.
        witness: [
          { piece: 'a', rotation: 0, at: [0, 0] },
          { piece: 'b', rotation: -2, at: [1, 1] },
        ],
        stars: [{ maxMoves: 2, maxElapsedMs: 1000 }],
      },
    };

    const level = LevelDefinition.of(file).buildWith(new FitLevelBuilder(new SquareGeometry()));

    const domino = [square(0, 0), square(1, 0)];
    const expected = FitLevel.of(
      TopologyId.square,
      BoardShape.of([square(0, 0), square(1, 0), square(0, 1), square(1, 1)]),
      [
        new Piece(new ShapeGroup(domino.map((c) => new CellNode(c))), PieceId.of('a')),
        new Piece(new ShapeGroup(domino.map((c) => new CellNode(c))), PieceId.of('b')),
      ],
      [star(2, 1000)],
    );
    expect(level.equals(expected, new SquareTopology())).toBe(true);
  });

  // The level checks its own invariant (classes.md decision 46), so no such level exists.
  it('should_throw_a_range_error_that_carries_the_id_and_build_no_level_when_the_file_has_two_pieces_with_one_id', () => {
    const file = withSection((section) => {
      section.pieces[2] = { id: 'a', cells: [[0, 0]] };
      section.witness[2] = { piece: 'a', rotation: 0, at: [1, 1] };
      return section;
    });
    let level: FitLevel<HexCoord> | undefined;

    const build = () => {
      level = built(file);
    };

    expect(build).toThrow(
      new RangeError('The level has two pieces with one id.', { cause: PieceId.of('a') }),
    );
    expect(level).toBeUndefined();
  });

  it('should_throw_a_range_error_that_carries_the_topology_when_the_file_names_another_geometry', () => {
    const create = () => built({ ...fitLevelFile(), topology: 'square' });

    expect(create).toThrow(
      new RangeError('A Fit level builder cannot read the coordinates of another topology.', {
        cause: { topology: TopologyId.square, geometry: hexGeometry },
      }),
    );
  });

  // A5: the areas of the pieces add up to the area of the figure.
  it('should_throw_a_range_error_when_the_pieces_and_the_figure_have_unequal_areas', () => {
    const smaller = withSection((section) => ({ ...section, figure: section.figure.slice(1) }));
    const larger = withSection((section) => ({ ...section, figure: [...section.figure, [3, 0]] }));

    expect(() => built(smaller)).toThrow(new RangeError(UNEQUAL_AREA));
    expect(() => built(larger)).toThrow(new RangeError(UNEQUAL_AREA));
  });

  // A5: the witness places each piece once and covers each cell of the figure once.
  it('should_throw_a_range_error_when_the_witness_does_not_cover_the_figure_exactly', () => {
    const broken = [
      // Piece b turns the wrong way, so it covers a cell outside the figure.
      withSection((section) => {
        section.witness[1] = { piece: 'b', rotation: 2, at: [2, 0] };
        return section;
      }),
      // Piece c covers a cell that piece a covers.
      withSection((section) => {
        section.witness[2] = { piece: 'c', rotation: 0, at: [0, 0] };
        return section;
      }),
      // The witness names a piece that the level does not have.
      withSection((section) => {
        section.witness[2] = { piece: 'd', rotation: 0, at: [1, 1] };
        return section;
      }),
      // The witness places piece c twice and leaves no place for another piece.
      withSection((section) => ({ ...section, witness: [...section.witness, section.witness[2]] })),
      // The witness leaves piece c out.
      withSection((section) => ({ ...section, witness: section.witness.slice(0, 2) })),
      // The figure lists one cell twice, so no witness covers it exactly.
      withSection((section) => ({
        ...section,
        figure: [...section.figure.slice(0, 5), [0, 0]],
      })),
    ];

    for (const file of broken) {
      expect(() => built(file)).toThrow(new RangeError(INEXACT_WITNESS));
    }
  });

  it('should_throw_a_range_error_that_carries_the_value_when_a_part_of_the_section_has_a_wrong_shape', () => {
    const NO_SECTION = 'The section of a Fit level needs a figure, pieces, a witness and stars.';
    const NO_ITEM = 'A Fit level needs a list of one item or more in each field.';
    const BAD_PIECE = 'A piece of a Fit level needs a text id and cells.';
    const BAD_PLACEMENT =
      'A placement of a Fit witness needs a piece id, a rotation and an offset.';
    const BAD_STAR = 'A star of a Fit level needs a move count and a time.';
    // Each case: the part that breaks the section, the message and the value of the error.
    // A value object that refuses a value keeps its own message, and its error has no value.
    const { pieces, witness, stars } = fitLevelFile().section;
    const cases: [(section: FitFile['section']) => unknown, string, unknown][] = [
      [() => 'figure', NO_SECTION, 'figure'],
      [(section) => ({ ...section, figure: undefined }), NO_SECTION, { pieces, witness, stars }],
      [(section) => ({ ...section, figure: [] }), NO_ITEM, []],
      [
        (section) => ({ ...section, figure: [[0, 'x']] }),
        'A cell of a Fit level is a list of numbers.',
        [0, 'x'],
      ],
      [
        (section) => ({ ...section, figure: [[0, 0, 0]] }),
        'A hex coordinate needs two values, not 3.',
        undefined,
      ],
      [(section) => ({ ...section, pieces: [{ id: 'a' }] }), BAD_PIECE, { id: 'a' }],
      [
        (section) => ({ ...section, pieces: [{ id: 3, cells: [[0, 0]] }] }),
        BAD_PIECE,
        { id: 3, cells: [[0, 0]] },
      ],
      [
        (section) => ({ ...section, pieces: [{ id: ' ', cells: [[0, 0]] }] }),
        'A piece id cannot be empty.',
        undefined,
      ],
      [(section) => ({ ...section, pieces: [{ id: 'a', cells: [] }] }), NO_ITEM, []],
      [
        (section) => ({ ...section, witness: [{ piece: 'a', at: [0, 0] }] }),
        BAD_PLACEMENT,
        { piece: 'a', at: [0, 0] },
      ],
      [
        (section) => ({ ...section, witness: [{ piece: 'a', rotation: 0.5, at: [0, 0] }] }),
        'A turn count needs a whole number, not 0.5.',
        undefined,
      ],
      [(section) => ({ ...section, stars: [{ maxMoves: 4 }] }), BAD_STAR, { maxMoves: 4 }],
      [
        (section) => ({ ...section, stars: [{ maxMoves: -1, maxElapsedMs: 0 }] }),
        'A move count needs a whole number of 0 or more, not -1.',
        undefined,
      ],
    ];

    for (const [change, message, cause] of cases) {
      const build = () => built(withSection(change));

      expect(build).toThrow(new RangeError(message, { cause }));
    }
  });

  it('should_throw_a_range_error_when_the_builder_builds_before_it_has_a_topology_and_a_section', () => {
    const message = 'A Fit level builder needs a topology and a section.';

    expect(() => new FitLevelBuilder(hexGeometry).build()).toThrow(new RangeError(message));
    expect(() => new FitLevelBuilder(hexGeometry).withTopology(TopologyId.hex).build()).toThrow(
      new RangeError(message),
    );
  });
});
