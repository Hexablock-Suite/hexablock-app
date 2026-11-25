/** @jest-environment node */
import { BoardShape } from '../../src/domain/engine/board-shape';
import { GameId } from '../../src/domain/engine/game-id';
import type { GeometryFactory } from '../../src/domain/engine/geometry-factory';
import { hex } from '../../src/domain/engine/hex-topology';
import { Mulberry32Random } from '../../src/domain/engine/mulberry32-random';
import { Piece } from '../../src/domain/engine/piece';
import { Seed } from '../../src/domain/engine/seed';
import {
  boardFigures,
  registeredGames,
  type BoardFigure,
} from '../../src/infrastructure/registered-games';
import { ManualClock } from '../support/engine/manual-clock';

// The count of pieces that each test draws. Eight shapes each come up many times in 400 draws.
const DRAWS = 400;

// The shapes of the first `DRAWS` pieces of the Hexa Lines entry of the board figure `figure`.
// The entry takes its seed from a fixed random source, so the draws are the same in each run.
function drawnLinesShapes<TCoord>(figure: BoardFigure<TCoord>): BoardShape<TCoord>[] {
  const games = registeredGames(figure, new ManualClock(), Mulberry32Random.from(Seed.of(1)));
  const lines = games.find((game) => game.gameId.equals(GameId.of('hexa-lines')));
  if (lines === undefined) throw new Error('The figure has no Hexa Lines entry.');
  const pieces = lines.withFactory({
    use: (_gameId, factory) => {
      const drawn: unknown[] = [];
      let source = factory.createPieceSource();
      while (source !== undefined && drawn.length < DRAWS) {
        const [piece, rest] = source.take();
        drawn.push(piece);
        source = rest;
      }
      return drawn;
    },
  });
  return pieces.map((piece) => {
    if (!(piece instanceof Piece)) throw new Error('Hexa Lines draws a piece.');
    return BoardShape.of((piece as Piece<unknown, TCoord>).coveredCoordinates());
  });
}

// The places in `expected` of the shapes that the draws cover, and the count of drawn shapes
// that match no expected shape.
function coverage<TCoord>(
  drawn: readonly BoardShape<TCoord>[],
  expected: readonly BoardShape<TCoord>[],
  geometry: GeometryFactory<TCoord>,
): { covered: number[]; unknown: number } {
  const topology = geometry.createTopology();
  const placeOf = (shape: BoardShape<TCoord>) =>
    expected.findIndex((candidate) => candidate.equals(shape, topology));
  const places = drawn.map(placeOf);
  return {
    covered: expected.map((_, i) => i).filter((i) => places.includes(i)),
    unknown: places.filter((place) => place === -1).length,
  };
}

// The piece shapes of the geometry of the board figure `figure`, as board shapes.
function geometryShapes<TCoord>(figure: BoardFigure<TCoord>): BoardShape<TCoord>[] {
  return figure.geometry.createPieceShapes().map((shape) => BoardShape.of(shape.cells()));
}

// APP-NFR-06, jury variation «a new piece shape» (view 2 of docs/architecture/extensibility.md):
// Hexa Lines on the hexagon draws one more shape, the hook of four cells.
describe('registeredGames, the piece set of Hexa Lines', () => {
  it('should_draw_the_hook_of_four_cells_and_every_hex_shape_when_hexa_lines_plays_on_the_hexagon', () => {
    const [hexagon] = boardFigures();
    if (hexagon === undefined) throw new Error('The app has no board figure.');
    const hook = BoardShape.of([hex(0, 0), hex(1, 0), hex(2, 0), hex(0, 1)]);
    const expected = [...geometryShapes(hexagon), hook];

    const { covered, unknown } = coverage(drawnLinesShapes(hexagon), expected, hexagon.geometry);

    expect(covered).toEqual(expected.map((_, i) => i));
    expect(unknown).toBe(0);
  });

  it('should_draw_only_the_shapes_of_the_geometry_when_hexa_lines_plays_on_the_square_or_the_triangle', () => {
    const [, ...others] = boardFigures();

    const results = others.map((figure) => {
      const expected = geometryShapes(figure);
      return coverage(drawnLinesShapes(figure), expected, figure.geometry);
    });

    expect(results).toEqual([
      { covered: [0, 1, 2, 3, 4, 5, 6], unknown: 0 },
      { covered: [0, 1, 2, 3, 4, 5, 6], unknown: 0 },
    ]);
  });
});
