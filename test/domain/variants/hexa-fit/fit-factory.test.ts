/** @jest-environment node */
import { GameOver } from '../../../../src/domain/engine/game-events';
import { Turns } from '../../../../src/domain/engine/turns';
import { PlaceFitPiece } from '../../../../src/domain/variants/hexa-fit/fit-move';
import { square, squareTopology } from '../../../support/engine/square-topology';
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
});
