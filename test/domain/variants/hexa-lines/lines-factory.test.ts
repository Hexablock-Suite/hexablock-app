/** @jest-environment node */
import type { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import type { Color } from '../../../../src/domain/variants/hexa-lines/color';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { firstValidMove, startVariant } from '../../../support/engine/variant-game';
import {
  blue,
  filledKeys,
  linesFactory,
  red,
} from '../../../support/variants/hexa-lines/lines-game';

// The Lines factory creates the whole family of Hexa Lines (issue 99, classes.md decision 31).

const domino = new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]);

// A piece as text: its color and the keys of its cells, so two pieces compare by value.
function describe_(piece: Piece<Color, SquareCoord>): string {
  const keys = piece.shape.cells().map((c) => squareTopology.key(c));
  return `${piece.content.name} ${keys.join(' ')}`;
}

function firstPieces(seed: number, count: number): string[] {
  const source = linesFactory(
    seed,
    [new CellNode(square(0, 0)), domino],
    [red, blue],
  ).createPieceSource();
  const pieces: string[] = [];
  for (const piece of source) {
    pieces.push(describe_(piece));
    if (pieces.length === count) break;
  }
  return pieces;
}

describe('LinesFactory', () => {
  it('should_start_a_game_that_plays_one_move_when_the_lines_factory_builds_it', () => {
    const factory = linesFactory();

    const initial = factory.createInitialState();
    const { engine, rules, publisher } = startVariant(factory);
    const outcome = engine.play(firstValidMove(rules, engine.snapshot()));

    expect(factory.gameId.value).toBe('hexa-lines');
    expect(factory.createBoard().shape.cells).toHaveLength(9);
    expect(initial.board.cells()).toEqual([]);
    expect(initial.tray).toHaveLength(3);
    expect(outcome).toBe('playing');
    expect(filledKeys(engine.snapshot())).toEqual(['0,0']);
    expect(engine.snapshot().tray).toHaveLength(2);
    // One placed cell gives 1 point: the factory picks the Lines scoring.
    expect(engine.snapshot().score).toBe(1);
    expect(publisher.events).toEqual([]);
  });

  it('should_draw_the_same_pieces_when_two_lines_factories_share_a_seed', () => {
    const pieces = firstPieces(42, 12);

    expect(firstPieces(42, 12)).toEqual(pieces);
    expect(firstPieces(43, 12)).not.toEqual(pieces);
    // The draw picks among the shapes and the colors of the settings.
    expect(new Set(pieces).size).toBeGreaterThan(1);
    expect(linesFactory(42).createInitialState().tray.map(describe_)).toEqual(
      linesFactory(42).createInitialState().tray.map(describe_),
    );
  });
});
