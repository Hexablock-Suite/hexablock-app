/** @jest-environment node */
import { TopologyId } from '../../../../src/domain/engine/geometry-factory';
import { Outcome } from '../../../../src/domain/engine/outcome';
import { ElapsedTime } from '../../../../src/domain/engine/elapsed-time';
import { Score } from '../../../../src/domain/engine/score';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { GameOver } from '../../../../src/domain/engine/game-events';
import { GameId } from '../../../../src/domain/engine/game-id';
import { TimedRulesDecorator } from '../../../../src/domain/engine/timed-rules-decorator';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { Turns } from '../../../../src/domain/engine/turns';
import { FitFactory } from '../../../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevel } from '../../../../src/domain/variants/hexa-fit/fit-level';
import { PlaceFitPiece } from '../../../../src/domain/variants/hexa-fit/fit-move';
import { FitRules } from '../../../../src/domain/variants/hexa-fit/fit-rules';
import { ManualClock } from '../../../support/engine/manual-clock';
import { square, squareTopology, type SquareCoord } from '../../../support/engine/square-topology';
import { startVariant } from '../../../support/engine/variant-game';
import { A, fitFactory, threeDominoFitFactory } from '../../../support/variants/hexa-fit/fit-game';
import { repoRoot } from '../../../support/run-tool';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID } from '../../../support/engine/entity-ids';

// The Fit factory creates the whole family of Hexa Fit (issue 99, classes.md decision 31).

describe('FitFactory', () => {
  it('should_start_the_level_and_win_it_with_one_move_when_the_fit_factory_builds_it', () => {
    const factory = fitFactory();

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { engine, publisher } = startVariant(factory);
    const outcome = engine.play(new PlaceFitPiece(A, Turns.of(0), square(0, 0)));

    expect(factory.gameId.equals(GameId.of('hexa-fit'))).toBe(true);
    expect(factory.createBoard(BOARD_ID).shape.cells.map((c) => squareTopology.key(c))).toEqual([
      '0,0',
      '1,0',
    ]);
    expect(initial.remaining().map((p) => p.content.value)).toEqual(['a']);
    expect(outcome).toBe(Outcome.victory);
    expect(engine.snapshot().score).toEqual(Score.of(0));
    expect(publisher.events).toEqual([
      new GameOver(factory.gameId, MATCH_ID, Outcome.victory, Score.of(0)),
    ]);
  });

  it('should_give_a_new_source_of_the_level_pieces_when_the_fit_factory_is_asked_twice', () => {
    const factory = fitFactory();

    const first = [...factory.createPieceSource()].map((p) => p.content.value);
    const second = [...factory.createPieceSource()].map((p) => p.content.value);

    expect(first).toEqual(['a']);
    expect(second).toEqual(['a']);
  });

  it('should_throw_a_range_error_when_the_fit_figure_repeats_a_coordinate', () => {
    // `BoardShape` keeps a repeated cell, and the board rejects it by its topology key.
    const factory = new FitFactory(
      new SquareGeometry(),
      FitLevel.of(TopologyId.square, BoardShape.of([square(0, 0), square(0, 0)]), []),
      new ManualClock(),
    );
    const message = 'Two coordinates of the shape have the same key.';

    expect(() => factory.createBoard(BOARD_ID)).toThrow(new RangeError(message));
    expect(() => factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID)).toThrow(
      new RangeError(message),
    );
  });

  it('should_wrap_the_fit_rules_in_the_timer_when_the_fit_factory_creates_the_rules', () => {
    const rules = fitFactory().createRules();

    expect(rules).toBeInstanceOf(TimedRulesDecorator);
    expect(new FitRules<SquareCoord>().timed()).toBeUndefined();
    expect(rules.timed()?.elapsedMs()).toEqual(ElapsedTime.ofMs(0));
  });

  it('should_give_each_game_its_own_timer_when_the_fit_factory_starts_two_games', () => {
    const clock = new ManualClock();
    const factory = threeDominoFitFactory(clock);
    const first = startVariant(factory);
    const second = startVariant(factory);

    first.engine.play(new PlaceFitPiece(A, Turns.of(0), square(0, 0)));
    clock.advance(1_000);

    expect(first.engine.timed()?.elapsedMs()).toEqual(ElapsedTime.ofMs(1_000));
    expect(second.engine.timed()?.elapsedMs()).toEqual(ElapsedTime.ofMs(0));
  });

  it('should_hold_no_timer_code_when_the_fit_rules_source_is_read', () => {
    const source = readFileSync(
      join(repoRoot, 'src/domain/variants/hexa-fit/fit-rules.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/timer|timed|clock|elapsed/i);
  });
});
