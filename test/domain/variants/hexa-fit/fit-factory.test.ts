/** @jest-environment node */
import { TopologyId } from '../../../../src/domain/shared/topology-id';
import { Outcome } from '../../../../src/domain/engine/outcome';
import { ElapsedTime } from '../../../../src/domain/shared/elapsed-time';
import { Score } from '../../../../src/domain/shared/score';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BoardShape } from '../../../../src/domain/engine/board-shape';
import { GameId } from '../../../../src/domain/shared/game-id';
import { LevelTimer } from '../../../../src/domain/engine/level-timer';
import { LevelTimerId } from '../../../../src/domain/engine/level-timer-id';
import { MatchId } from '../../../../src/domain/engine/match-id';
import { Moves } from '../../../../src/domain/shared/moves';
import { RedoableHistory } from '../../../../src/domain/engine/redoable-history';
import { TimedRulesDecorator } from '../../../../src/domain/engine/timed-rules-decorator';
import { SquareGeometry } from '../../../../src/domain/engine/square-geometry';
import { Turns } from '../../../../src/domain/engine/turns';
import { FitFactory } from '../../../../src/domain/variants/hexa-fit/fit-factory';
import { FitLevel } from '../../../../src/domain/variants/hexa-fit/fit-level';
import { PlaceFitPiece } from '../../../../src/domain/variants/hexa-fit/fit-move';
import { FitRules } from '../../../../src/domain/variants/hexa-fit/fit-rules';
import { ManualClock } from '../../../support/engine/manual-clock';
import { square, squareTopology } from '../../../support/engine/square-topology';
import { startVariant } from '../../../support/engine/variant-game';
import {
  A,
  B,
  fitFactory,
  threeDominoFitFactory,
} from '../../../support/variants/hexa-fit/fit-game';
import { fitViewData } from '../../../support/variants/view-data';
import { repoRoot } from '../../../support/run-tool';
import { dataOf } from '../../../support/engine/game-over';
import { MATCH_ID } from '../../../support/engine/match-id';
import { BOARD_ID, STATE_ID, TIMER_ID } from '../../../support/engine/entity-ids';
import { delivered } from '../../../support/engine/value-receiver';

// The Fit factory creates the whole family of Hexa Fit (issue 99, classes.md decision 31).

describe('FitFactory', () => {
  it('should_start_the_level_and_win_it_with_one_move_when_the_fit_factory_builds_it', () => {
    const factory = fitFactory();

    const initial = factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID);
    const { engine } = startVariant(factory);
    const outcome = engine.play(new PlaceFitPiece(A, Turns.of(0), square(0, 0)));

    expect([factory.isFor(GameId.of('hexa-fit')), factory.isFor(GameId.of('hexa-sort'))]).toEqual([
      true,
      false,
    ]);
    expect(
      factory
        .createBoard(BOARD_ID)
        .coordinates()
        .map((c) => delivered(squareTopology.key(c))),
    ).toEqual(['0,0', '1,0']);
    expect(initial.remaining().map((p) => delivered(p.occupant()))).toEqual(['a']);
    expect(outcome).toBe(Outcome.victory);
    expect(engine.snapshot().scoreSoFar()).toEqual(Score.of(0));
    expect(engine.takeEvents().map(dataOf)).toEqual([
      {
        gameId: GameId.of('hexa-fit'),
        matchId: MATCH_ID,
        outcome: Outcome.victory,
        finalScore: Score.of(0),
      },
    ]);
  });

  it('should_give_a_new_source_of_the_level_pieces_when_the_fit_factory_is_asked_twice', () => {
    const factory = fitFactory();

    const first = [...factory.createPieceSource()].map((p) => delivered(p.occupant()));
    const second = [...factory.createPieceSource()].map((p) => delivered(p.occupant()));

    expect(first).toEqual(['a']);
    expect(second).toEqual(['a']);
  });

  it('should_throw_a_range_error_when_the_fit_figure_repeats_a_coordinate', () => {
    // `BoardShape` keeps a repeated cell, and the board rejects it by its topology key.
    const factory = new FitFactory(
      new SquareGeometry(),
      FitLevel.of(TopologyId.square, BoardShape.of([square(0, 0), square(0, 0)]), [], []),
      new ManualClock(),
    );
    const message = 'Two coordinates of the shape have the same key.';

    expect(() => factory.createBoard(BOARD_ID)).toThrow(new RangeError(message));
    expect(() => factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID)).toThrow(
      new RangeError(message),
    );
  });

  // The factory gives the timer as an optional part, as it gives the history.
  // `GameFactory` wraps the rules in `TimedRulesDecorator` (issue #234, decision 19).
  it('should_give_plain_fit_rules_and_a_new_timer_when_the_fit_factory_creates_them', () => {
    const factory = fitFactory();
    const timer = factory.createTimer(MATCH_ID);

    expect(factory.createRules()).toBeInstanceOf(FitRules);
    expect(timer).toBeInstanceOf(LevelTimer);
    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(0));
    expect(timer).not.toBe(factory.createTimer(MATCH_ID));
  });

  it('should_give_each_game_its_own_timer_when_the_fit_factory_starts_two_games', () => {
    const clock = new ManualClock();
    const factory = threeDominoFitFactory(clock);
    const first = startVariant(factory);
    const second = startVariant(factory);

    first.engine.play(new PlaceFitPiece(A, Turns.of(0), square(0, 0)));
    clock.advance(1_000);

    expect(first.engine.elapsedTime()).toEqual(ElapsedTime.ofMs(1_000));
    expect(second.engine.elapsedTime()).toEqual(ElapsedTime.ofMs(0));
  });

  // The timer is an entity with a local id (issue #236, classes.md decisions 19, 50 and 52).
  // The test compares the timer with a timer that holds the expected id.
  it('should_give_the_timer_the_id_of_the_match_when_the_fit_factory_creates_the_timer', () => {
    const clock = new ManualClock();

    const timer = fitFactory(clock).createTimer(MATCH_ID);

    expect([
      timer.equals(new LevelTimer(TIMER_ID, clock)),
      timer.equals(new LevelTimer(LevelTimerId.of(MATCH_ID), new ManualClock())),
      timer.equals(new LevelTimer(LevelTimerId.of(MatchId.of('match-b')), clock)),
    ]).toEqual([true, true, false]);
  });

  it('should_give_two_timers_with_different_ids_and_separate_readings_when_the_timers_are_created_for_two_matches', () => {
    const clock = new ManualClock();
    const factory = threeDominoFitFactory(clock);
    const first = factory.createTimer(MatchId.of('match-a'));
    const second = factory.createTimer(MatchId.of('match-b'));
    const firstRules = new TimedRulesDecorator(factory.createRules(), first);

    firstRules.playTurn(
      factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID),
      new PlaceFitPiece(A, Turns.of(0), square(0, 0)),
    );
    clock.advance(1_000);

    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
    expect(first.equals(new LevelTimer(LevelTimerId.of(MatchId.of('match-a')), clock))).toBe(true);
    expect(second.equals(new LevelTimer(LevelTimerId.of(MatchId.of('match-b')), clock))).toBe(true);
    expect(first.elapsedMs()).toEqual(ElapsedTime.ofMs(1_000));
    expect(second.elapsedMs()).toEqual(ElapsedTime.ofMs(0));
  });

  // Issue #178, the check of APP-FR-08: in Fit, undo and then redo give back the same board.
  // The move count follows #60: the undo gives back the count before the move, and the redo
  // gives back the count after it.
  it('should_give_back_the_same_board_and_move_count_when_a_fit_move_is_undone_and_then_redone', () => {
    const factory = threeDominoFitFactory();
    const { engine } = startVariant(factory);
    const facts = () => {
      const photo = engine.snapshot();
      const { placed, moves } = fitViewData(photo.view());
      return { cells: photo.boardCopy().occupiedCells(), placed, moves };
    };
    const start = facts();
    engine.play(new PlaceFitPiece(A, Turns.of(0), square(0, 0)));
    engine.play(new PlaceFitPiece(B, Turns.of(0), square(2, 0)));
    const played = facts();

    engine.undo();
    const undone = facts();
    engine.undo();
    engine.redo();
    engine.redo();

    expect(factory.createHistory()).toBeInstanceOf(RedoableHistory);
    expect(undone.moves).toEqual(Moves.of(1));
    expect(facts()).toEqual(played);
    expect(played.moves).toEqual(Moves.of(2));
    expect(played.cells).not.toEqual(start.cells);
    expect([engine.canUndo(), engine.canRedo()]).toEqual([true, false]);
  });

  it('should_hold_no_timer_code_when_the_fit_rules_source_is_read', () => {
    const source = readFileSync(
      join(repoRoot, 'src/domain/variants/hexa-fit/fit-rules.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/timer|timed|clock|elapsed/i);
  });
});
