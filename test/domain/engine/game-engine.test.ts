/** @jest-environment node */
import type { Board } from '../../../src/domain/engine/board';
import type { BoardState } from '../../../src/domain/engine/board-state';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameOver } from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/engine/game-id';
import type { Outcome } from '../../../src/domain/engine/outcome';
import { Resolution } from '../../../src/domain/engine/resolution';
import { fakeCell, type FakeCell } from '../../support/engine/fake-cell';
import {
  emptyState,
  FakeRules,
  FakeState,
  OnePointScoring,
  RecordingPublisher,
  type FakeMove,
} from '../../support/engine/fake-game';
import { square, type SquareCoord } from '../../support/engine/square-topology';

// The turn cycle (statement §3.1): start, receive, validate, apply, resolve, evaluate, notify.
// The cell type, the rules and the scoring exist only in test/ (APP-NFR-13).

function newGame(log: string[] = []) {
  const publisher = new RecordingPublisher(log);
  const engine = new GameEngine(
    GameId.of('fake-game'),
    new FakeRules(log),
    new OnePointScoring(log),
    publisher,
  );
  return { engine, publisher };
}

// Rules that fail once in `resolve()`, after `apply()` has put the cell on the board.
class FailingOnceRules extends FakeRules {
  private failed = false;
  override resolve(state: FakeState): Resolution<FakeState> {
    if (!this.failed) {
      this.failed = true;
      throw new Error('resolve failed');
    }
    return super.resolve(state);
  }
}

// A scoring policy that fails once.
class FailingOnceScoring extends OnePointScoring {
  private failed = false;
  override score(before: FakeState, resolution: Resolution<FakeState>): number {
    if (!this.failed) {
      this.failed = true;
      throw new Error('score failed');
    }
    return super.score(before, resolution);
  }
}

// Rules whose `resolve()` refuses the move after `apply()` has put the cell on the copy.
class RejectingResolveRules extends FakeRules {
  override resolve(state: FakeState): Resolution<FakeState> {
    this.log.push('resolve');
    return Resolution.rejected(state);
  }
}

// Rules that throw in one step while `armed` is true.
// `apply()` throws after it has put the cell on the copy.
class ThrowingStepRules extends FakeRules {
  armed = false;

  constructor(private readonly step: 'apply' | 'evaluate') {
    super();
  }

  override apply(state: FakeState, move: FakeMove): FakeState {
    const next = super.apply(state, move);
    if (this.armed && this.step === 'apply') throw new Error('apply failed');
    return next;
  }

  override evaluate(state: FakeState): Outcome {
    if (this.armed && this.step === 'evaluate') throw new Error('evaluate failed');
    return super.evaluate(state);
  }
}

// A scoring policy that calls `engine.play()` again from `score()`, a reentrant call.
// It keeps the error of the inner call and scores the outer turn.
class ReentrantScoring extends OnePointScoring {
  engine: GameEngine<FakeCell, SquareCoord, FakeMove, FakeState> | undefined;
  innerError: unknown;

  override score(before: FakeState, resolution: Resolution<FakeState>): number {
    try {
      this.engine?.play(place(1, 0));
    } catch (error) {
      this.innerError = error;
    }
    return super.score(before, resolution);
  }
}

function place(col: number, row: number, value = 1): FakeMove {
  return { at: square(col, row), cell: fakeCell(value) };
}

describe('GameEngine.play()', () => {
  it('should_run_the_turn_steps_in_order_when_a_valid_move_is_played', () => {
    const log: string[] = [];
    const { engine } = newGame(log);
    engine.start(emptyState());

    engine.play(place(0, 0));

    expect(log).toEqual(['isValid', 'apply', 'resolve', 'evaluate', 'score']);
  });

  it('should_put_the_cell_on_the_board_and_add_points_when_the_move_is_valid', () => {
    const { engine } = newGame();
    engine.start(emptyState());

    const outcome = engine.play(place(1, 0, 7));

    expect(outcome).toBe('playing');
    expect(engine.snapshot().board.get(square(1, 0))).toEqual(fakeCell(7));
    expect(engine.snapshot().score).toBe(1);
  });

  it('should_keep_the_board_and_the_score_when_the_move_is_invalid', () => {
    const { engine } = newGame();
    engine.start(emptyState());
    engine.play(place(0, 0));

    const outcome = engine.play(place(0, 0, 9));

    expect(outcome).toBe('playing');
    expect(engine.snapshot().board.get(square(0, 0))).toEqual(fakeCell(1));
    expect(engine.snapshot().score).toBe(1);
    expect(engine.phase.canPlay()).toBe(true);
  });

  it('should_keep_the_old_board_when_resolve_rejects_the_move_after_apply', () => {
    const publisher = new RecordingPublisher();
    const engine = new GameEngine(
      GameId.of('fake-game'),
      new RejectingResolveRules(),
      new OnePointScoring(),
      publisher,
    );
    engine.start(emptyState());

    const outcome = engine.play(place(0, 0));

    expect(outcome).toBe('playing');
    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
    expect(engine.snapshot().score).toBe(0);
    expect(engine.phase.name).toBe('playing');
    expect(publisher.events).toEqual([]);
  });

  it('should_publish_game_over_with_the_final_score_when_the_board_fills', () => {
    const { engine, publisher } = newGame();
    engine.start(emptyState());

    [place(0, 0), place(1, 0), place(0, 1)].forEach((move) => engine.play(move));
    const outcome = engine.play(place(1, 1));

    expect(outcome).toBe('game-over');
    expect(engine.phase.name).toBe('game-over');
    expect(publisher.events).toHaveLength(1);
    const event = publisher.events[0] as GameOver;
    expect(event).toBeInstanceOf(GameOver);
    expect(event.gameId.value).toBe('fake-game');
    expect(event.outcome).toBe('game-over');
    expect(event.finalScore).toBe(4);
  });

  it('should_publish_nothing_when_the_game_goes_on', () => {
    const { engine, publisher } = newGame();
    engine.start(emptyState());

    engine.play(place(0, 0));

    expect(publisher.events).toEqual([]);
  });

  it('should_throw_when_play_runs_before_start', () => {
    const { engine } = newGame();

    expect(() => engine.play(place(0, 0))).toThrow('not started');
  });

  it('should_throw_and_keep_the_board_when_the_game_is_paused', () => {
    const { engine } = newGame();
    engine.start(emptyState());
    engine.pause();

    expect(() => engine.play(place(0, 0))).toThrow('cannot accept a move');
    expect(engine.snapshot().board.cells()).toEqual([]);
  });

  it('should_accept_moves_again_when_a_paused_game_resumes', () => {
    const { engine } = newGame();
    engine.start(emptyState());
    engine.pause();
    engine.resume();

    expect(engine.play(place(0, 0))).toBe('playing');
  });

  it('should_throw_when_a_move_comes_after_game_over', () => {
    const { engine } = newGame();
    engine.start(emptyState(1));
    engine.play(place(0, 0));

    expect(() => engine.play(place(0, 0))).toThrow('cannot accept a move');
  });

  it('should_keep_the_engine_unchanged_when_a_snapshot_is_changed', () => {
    const { engine } = newGame();
    engine.start(emptyState());

    const copy = engine.snapshot();
    copy.board.set(square(0, 0), fakeCell(5));
    copy.score = 99;

    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
    expect(engine.snapshot().score).toBe(0);
  });

  it('should_keep_the_engine_unchanged_when_the_initial_state_is_changed_after_start', () => {
    const { engine } = newGame();
    const initial = emptyState();
    engine.start(initial);

    initial.board.set(square(0, 0), fakeCell(5));

    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
  });

  it('should_keep_the_board_and_accept_the_next_move_when_the_rules_throw', () => {
    const engine = new GameEngine(
      GameId.of('fake-game'),
      new FailingOnceRules(),
      new OnePointScoring(),
      new RecordingPublisher(),
    );
    engine.start(emptyState());

    expect(() => engine.play(place(0, 0))).toThrow('resolve failed');

    expect(engine.phase.canPlay()).toBe(true);
    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
    expect(engine.snapshot().score).toBe(0);
    expect(engine.play(place(0, 0))).toBe('playing');
    expect(engine.snapshot().board.get(square(0, 0))).toEqual(fakeCell(1));
  });

  it('should_keep_the_board_and_accept_the_next_move_when_the_scoring_throws', () => {
    const engine = new GameEngine(
      GameId.of('fake-game'),
      new FakeRules(),
      new FailingOnceScoring(),
      new RecordingPublisher(),
    );
    engine.start(emptyState());

    expect(() => engine.play(place(0, 0))).toThrow('score failed');

    expect(engine.phase.canPlay()).toBe(true);
    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
    expect(engine.snapshot().score).toBe(0);
    expect(engine.play(place(0, 0))).toBe('playing');
    expect(engine.snapshot().score).toBe(1);
  });
});

// A state with one member more than `BoardState`, like a variant state.
// Its `clone()` promises only the base `BoardState`, and its copy is a `FakeState`.
class BaseCloneState implements BoardState<FakeCell, SquareCoord> {
  readonly level = 1;

  constructor(
    readonly board: Board<FakeCell, SquareCoord>,
    public score = 0,
  ) {}

  clone(): BoardState<FakeCell, SquareCoord> {
    return new FakeState(this.board.clone(), this.score);
  }
}

// A game with one played move, whose rules throw in `step` on the next move.
function armedGame(step: 'apply' | 'evaluate') {
  const rules = new ThrowingStepRules(step);
  const engine = new GameEngine(
    GameId.of('fake-game'),
    rules,
    new OnePointScoring(),
    new RecordingPublisher(),
  );
  engine.start(emptyState());
  engine.play(place(0, 0));
  rules.armed = true;
  return { engine, rules };
}

// The board cells, the score and the phase name of a game.
function summary(engine: GameEngine<FakeCell, SquareCoord, FakeMove, FakeState>) {
  const state = engine.snapshot();
  return { cells: state.board.cells(), score: state.score, phase: engine.phase.name };
}

const afterOneMove = { cells: [[square(0, 0), fakeCell(1)]], score: 1, phase: 'playing' };

describe('GameEngine edge cases', () => {
  it('should_keep_the_board_the_score_and_the_phase_when_apply_throws', () => {
    const { engine, rules } = armedGame('apply');

    expect(() => engine.play(place(1, 0))).toThrow('apply failed');

    expect(summary(engine)).toEqual(afterOneMove);
    rules.armed = false;
    expect(engine.play(place(1, 0))).toBe('playing');
  });

  it('should_keep_the_board_the_score_and_the_phase_when_evaluate_throws', () => {
    const { engine, rules } = armedGame('evaluate');

    expect(() => engine.play(place(1, 0))).toThrow('evaluate failed');

    expect(summary(engine)).toEqual(afterOneMove);
    rules.armed = false;
    expect(engine.play(place(1, 0))).toBe('playing');
  });

  // `play()` enters the resolving phase before it calls the rules and the scoring.
  // The resolving phase refuses a move, so a reentrant `play()` throws a RangeError.
  it('should_reject_a_reentrant_play_when_the_scoring_calls_play_during_a_turn', () => {
    const scoring = new ReentrantScoring();
    const engine = new GameEngine(
      GameId.of('fake-game'),
      new FakeRules(),
      scoring,
      new RecordingPublisher(),
    );
    scoring.engine = engine;
    engine.start(emptyState());

    const outcome = engine.play(place(0, 0));

    expect(scoring.innerError).toBeInstanceOf(RangeError);
    expect(String(scoring.innerError)).toContain('cannot accept a move in the resolving phase');
    expect(outcome).toBe('playing');
    expect(summary(engine)).toEqual(afterOneMove);
  });

  it('should_start_a_new_game_when_start_runs_after_game_over', () => {
    const { engine, publisher } = newGame();
    engine.start(emptyState(1));
    engine.play(place(0, 0));

    engine.start(emptyState(1));

    expect(engine.phase.name).toBe('playing');
    expect(engine.snapshot().board.cells()).toEqual([]);
    expect(engine.snapshot().score).toBe(0);
    expect(engine.play(place(0, 0))).toBe('game-over');
    expect(publisher.events).toHaveLength(2);
  });
});

describe('GameEngine type parameters', () => {
  it('should_reject_the_state_type_when_its_clone_returns_the_base_board_state', () => {
    const state = new BaseCloneState(emptyState().board);

    // @ts-expect-error The engine copies the state, so clone() must return the state type.
    type Rejected = GameEngine<FakeCell, SquareCoord, FakeMove, BaseCloneState>;
    const rejected: Rejected | undefined = undefined;

    expect(rejected).toBeUndefined();
    expect(state.clone()).not.toBeInstanceOf(BaseCloneState);
  });
});
