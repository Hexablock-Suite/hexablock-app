/** @jest-environment node */
import { GameId } from '../../../../src/domain/engine/game-id';
import type { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import type { Color } from '../../../../src/domain/engine/color';
import { PlacePiece } from '../../../../src/domain/variants/hexa-lines/place-piece';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { firstValidMove, startVariant } from '../../../support/engine/variant-game';
import {
  blue,
  filledKeys,
  linesFactory,
  linesGame,
  linesState,
  piece,
  red,
} from '../../../support/variants/hexa-lines/lines-game';
import { MATCH_ID } from '../../../support/engine/match-id';

// The Lines factory creates the whole family of Hexa Lines (issue 99, classes.md decision 31).

const domino = new ShapeGroup([new CellNode(square(0, 0)), new CellNode(square(1, 0))]);

// A piece as text: its color and the keys of its cells, so two pieces compare by value.
// `Color` keeps its name private, so `equals()` names the color. These tests draw red or blue.
function describe_(piece: Piece<Color, SquareCoord>): string {
  const keys = piece.shape.cells().map((c) => squareTopology.key(c));
  const color = piece.content.equals(red) ? 'red' : 'blue';
  return `${color} ${keys.join(' ')}`;
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

    const initial = factory.createInitialState(MATCH_ID);
    const { engine, rules, publisher } = startVariant(factory);
    const outcome = engine.play(firstValidMove(rules, engine.snapshot()));

    expect(factory.gameId.equals(GameId.of('hexa-lines'))).toBe(true);
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
    expect(linesFactory(42).createInitialState(MATCH_ID).tray.map(describe_)).toEqual(
      linesFactory(42).createInitialState(MATCH_ID).tray.map(describe_),
    );
  });

  it('should_multiply_the_line_bonus_by_the_combo_when_the_lines_factory_scoring_scores_two_lines', () => {
    // One cell at the origin fills row 0 and column 0 of a 3 × 3 board.
    const one = piece(square(0, 0));
    const { engine } = linesGame(
      linesState(squareTopology, 3, {
        filled: [square(1, 0), square(2, 0), square(0, 1), square(0, 2), square(2, 2)],
        tray: [one, one],
      }),
      linesFactory().createScoring(),
    );

    engine.play(new PlacePiece(0, square(0, 0)));

    expect(engine.snapshot().linesCleared).toBe(2);
    // 1 cell + 10 × 2 lines × (2 + 1 - 1). The base scoring alone gives 21.
    expect(engine.snapshot().score).toBe(41);
  });

  it('should_throw_a_range_error_when_the_lines_settings_hold_a_seed_that_is_not_a_32_bit_integer', () => {
    for (const seed of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, -1, 2 ** 53]) {
      const message = `A seed must be an integer from 0 to 4294967295, not ${seed}.`;

      expect(() => linesFactory(seed).createPieceSource()).toThrow(new RangeError(message));
      expect(() => linesFactory(seed).createInitialState(MATCH_ID)).toThrow(
        new RangeError(message),
      );
    }
  });

  it('should_draw_the_pieces_of_seed_zero_when_the_lines_settings_hold_a_negative_zero_seed', () => {
    expect(firstPieces(-0, 12)).toEqual(firstPieces(0, 12));
  });
});
