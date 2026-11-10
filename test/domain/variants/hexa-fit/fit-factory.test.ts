/** @jest-environment node */
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { GameOver } from '../../../../src/domain/engine/game-events';
import { Piece } from '../../../../src/domain/engine/piece';
import { CellNode, ShapeGroup } from '../../../../src/domain/engine/shape-node';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { Turns } from '../../../../src/domain/engine/turns';
import { FitFactory } from '../../../../src/domain/variants/hexa-fit/fit-factory';
import { PlaceFitPiece } from '../../../../src/domain/variants/hexa-fit/fit-move';
import type { PieceId } from '../../../../src/domain/variants/hexa-fit/piece-id';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { startVariant } from '../../../support/engine/variant-game';
import { A, fitFactory } from '../../../support/variants/hexa-fit/fit-game';

// The Fit factory creates the whole family of Hexa Fit (issue 99, classes.md decision 31).

describe('FitFactory', () => {
  it('should_start_the_level_and_win_it_with_one_move_when_the_fit_factory_builds_it', () => {
    const factory = fitFactory();

    const initial = factory.createInitialState();
    const { engine, publisher } = startVariant(factory);
    const outcome = engine.play(new PlaceFitPiece(A, Turns.of(0), square(0, 0)));

    expect(factory.gameId.value).toBe('hexa-fit');
    expect(factory.createBoard().shape.cells.map((c) => squareTopology.key(c))).toEqual([
      '0,0',
      '1,0',
    ]);
    expect(initial.remaining().map((p) => p.content.value)).toEqual(['a']);
    expect(outcome).toBe('victory');
    expect(engine.snapshot().score).toBe(0);
    expect(publisher.events).toEqual([new GameOver(factory.gameId, 'victory', 0)]);
  });

  it('should_give_a_new_source_of_the_level_pieces_when_the_fit_factory_is_asked_twice', () => {
    const factory = fitFactory();

    const first = [...factory.createPieceSource()].map((p) => p.content.value);
    const second = [...factory.createPieceSource()].map((p) => p.content.value);

    expect(first).toEqual(['a']);
    expect(second).toEqual(['a']);
  });

  it('should_throw_a_range_error_when_the_fit_level_pieces_hold_undefined', () => {
    // Only a cast or a sparse list puts `undefined` in the pieces, as a broken level file would.
    const cell = new Piece(new ShapeGroup([new CellNode(square(0, 0))]), A);
    const pieces = [cell, undefined] as unknown as Piece<PieceId, SquareCoord>[];
    const factory = new FitFactory(new SquareGeometry(), {
      topology: 'square',
      figure: BoardShape.of([square(0, 0), square(1, 0)]),
      pieces,
    });
    const message = 'A piece list cannot hold undefined.';

    expect(() => factory.createPieceSource()).toThrow(new RangeError(message));
    expect(() => factory.createInitialState()).toThrow(new RangeError(message));
  });

  it('should_throw_a_range_error_when_the_fit_figure_repeats_a_coordinate', () => {
    // `BoardShape` keeps a repeated cell, and the board rejects it by its topology key.
    const factory = new FitFactory(new SquareGeometry(), {
      topology: 'square',
      figure: BoardShape.of([square(0, 0), square(0, 0)]),
      pieces: [],
    });
    const message = 'Two coordinates of the shape have the same key.';

    expect(() => factory.createBoard()).toThrow(new RangeError(message));
    expect(() => factory.createInitialState()).toThrow(new RangeError(message));
  });
});
