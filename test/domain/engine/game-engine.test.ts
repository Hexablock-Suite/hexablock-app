/** @jest-environment node */
import { Score } from '../../../src/domain/engine/score';
import type { Board, ReadonlyBoard } from '../../../src/domain/engine/board';
import type { BoardState } from '../../../src/domain/engine/board-state';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameOver } from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/engine/game-id';
import { MatchId } from '../../../src/domain/engine/match-id';
import { GameOverPhase, PlayingPhase, VictoryPhase } from '../../../src/domain/engine/game-phase';
import { Outcome } from '../../../src/domain/engine/outcome';
import { FixedListPieceSource } from '../../../src/domain/engine/piece-source';
import { Resolution } from '../../../src/domain/engine/resolution';
import { fakeCell, type FakeCell } from '../../support/engine/fake-cell';
import {
  emptyState,
  FakeRules,
  FakeState,
  OnePointScoring,
  RecordingPublisher,
  SourceRules,
  sourceState,
  type FakeMove,
  type FakeSnapshot,
  type SourceState,
} from '../../support/engine/fake-game';
import { STATE_ID } from '../../support/engine/entity-ids';
import { phaseNameOf } from '../../support/engine/phase-name';
import { square, type SquareAxis, type SquareCoord } from '../../support/engine/square-topology';
import { MATCH_ID } from '../../support/engine/match-id';

// The turn cycle (statement §3.1): start, receive, validate, apply, resolve, evaluate, notify.
// The cell type, the rules and the scoring exist only in test/ (APP-NFR-13).

function newGame(log: string[] = []) {
  const publisher = new RecordingPublisher(log);
  const engine = new GameEngine(
    MATCH_ID,
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
  override resolve(state: FakeState): Resolution {
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
  override score(before: FakeSnapshot, after: FakeSnapshot): Score {
    if (!this.failed) {
      this.failed = true;
      throw new Error('score failed');
    }
    return super.score(before, after);
  }
}

// Rules whose `resolve()` refuses the move after `apply()` has put the cell on the copy.
class RejectingResolveRules extends FakeRules {
  override resolve(state: FakeState): Resolution {
    this.log.push('resolve');
    return Resolution.rejected();
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

  override score(before: FakeSnapshot, after: FakeSnapshot): Score {
    try {
      this.engine?.play(place(1, 0));
    } catch (error) {
      this.innerError = error;
    }
    return super.score(before, after);
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

    expect(outcome).toBe(Outcome.playing);
    expect(engine.snapshot().board.get(square(1, 0))).toEqual(fakeCell(7));
    expect(engine.snapshot().score).toEqual(Score.of(1));
  });

  it('should_keep_the_board_and_the_score_when_the_move_is_invalid', () => {
    const { engine } = newGame();
    engine.start(emptyState());
    engine.play(place(0, 0));

    const outcome = engine.play(place(0, 0, 9));

    expect(outcome).toBe(Outcome.playing);
    expect(engine.snapshot().board.get(square(0, 0))).toEqual(fakeCell(1));
    expect(engine.snapshot().score).toEqual(Score.of(1));
    expect(engine.currentPhase().canPlay()).toBe(true);
  });

  it('should_keep_the_old_board_when_resolve_rejects_the_move_after_apply', () => {
    const publisher = new RecordingPublisher();
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new RejectingResolveRules(),
      new OnePointScoring(),
      publisher,
    );
    engine.start(emptyState());

    const outcome = engine.play(place(0, 0));

    expect(outcome).toBe(Outcome.playing);
    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
    expect(engine.snapshot().score).toEqual(Score.of(0));
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(publisher.events).toEqual([]);
  });

  it('should_publish_game_over_with_the_final_score_when_the_board_fills', () => {
    const { engine, publisher } = newGame();
    engine.start(emptyState());

    [place(0, 0), place(1, 0), place(0, 1)].forEach((move) => engine.play(move));
    const outcome = engine.play(place(1, 1));

    expect(outcome).toBe(Outcome.gameOver);
    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
    expect(publisher.events).toHaveLength(1);
    const event = publisher.events[0] as GameOver;
    expect(event).toBeInstanceOf(GameOver);
    expect(event.gameId.equals(GameId.of('fake-game'))).toBe(true);
    expect(event.outcome).toBe(Outcome.gameOver);
    expect(event.finalScore).toEqual(Score.of(4));
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

    expect(() => engine.play(place(0, 0))).toThrow(RangeError);
    expect(() => engine.play(place(0, 0))).toThrow(
      new RangeError('The game cannot accept a move in the paused phase.'),
    );
    expect(engine.snapshot().board.cells()).toEqual([]);
  });

  it('should_accept_moves_again_when_a_paused_game_resumes', () => {
    const { engine } = newGame();
    engine.start(emptyState());
    engine.pause();
    engine.resume();

    expect(engine.play(place(0, 0))).toBe(Outcome.playing);
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
    // The photo shows a read-only board and is frozen. A cast reaches its copy of the board.
    (copy.board as Board<FakeCell, SquareCoord, SquareAxis>).occupy(square(0, 0), fakeCell(5));
    expect(Reflect.set(copy, 'score', 99)).toBe(false);

    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
    expect(engine.snapshot().score).toEqual(Score.of(0));
  });

  it('should_keep_the_engine_unchanged_when_the_initial_state_is_changed_after_start', () => {
    const { engine } = newGame();
    const initial = emptyState();
    engine.start(initial);

    initial.board.occupy(square(0, 0), fakeCell(5));

    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
  });

  it('should_keep_the_board_and_accept_the_next_move_when_the_rules_throw', () => {
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new FailingOnceRules(),
      new OnePointScoring(),
      new RecordingPublisher(),
    );
    engine.start(emptyState());

    expect(() => engine.play(place(0, 0))).toThrow('resolve failed');

    expect(engine.currentPhase().canPlay()).toBe(true);
    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
    expect(engine.snapshot().score).toEqual(Score.of(0));
    expect(engine.play(place(0, 0))).toBe(Outcome.playing);
    expect(engine.snapshot().board.get(square(0, 0))).toEqual(fakeCell(1));
  });

  it('should_keep_the_board_and_accept_the_next_move_when_the_scoring_throws', () => {
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new FakeRules(),
      new FailingOnceScoring(),
      new RecordingPublisher(),
    );
    engine.start(emptyState());

    expect(() => engine.play(place(0, 0))).toThrow('score failed');

    expect(engine.currentPhase().canPlay()).toBe(true);
    expect(engine.snapshot().board.get(square(0, 0))).toBeUndefined();
    expect(engine.snapshot().score).toEqual(Score.of(0));
    expect(engine.play(place(0, 0))).toBe(Outcome.playing);
    expect(engine.snapshot().score).toEqual(Score.of(1));
  });
});

// A state with one member more than `BoardState`, like a variant state.
// Its `clone()` promises only the base `BoardState`, and its copy is a `FakeState`.
class BaseCloneState implements BoardState<FakeCell, SquareCoord> {
  readonly level = 1;

  constructor(
    readonly board: Board<FakeCell, SquareCoord, SquareAxis>,
    public score: Score = Score.of(0),
  ) {}

  addPoints(points: Score): void {
    this.score = this.score.add(points);
  }

  belongsTo(match: MatchId): boolean {
    return MATCH_ID.equals(match);
  }

  equals(other: BoardState<FakeCell, SquareCoord>): boolean {
    return other.belongsTo(MATCH_ID);
  }

  clone(): BoardState<FakeCell, SquareCoord> {
    return new FakeState(this.board.clone(), this.score);
  }

  snapshot(): FakeSnapshot {
    const view = Object.freeze({ filled: this.board.cells().length });
    return Object.freeze({
      stateId: STATE_ID,
      matchId: MATCH_ID,
      board: this.board.clone(),
      score: this.score,
      view: () => view,
    });
  }

  restore(snapshot: FakeSnapshot): void {
    this.board.restore(snapshot.board as ReadonlyBoard<FakeCell, SquareCoord, SquareAxis>);
    this.score = snapshot.score;
  }
}

// A game with one played move, whose rules throw in `step` on the next move.
function armedGame(step: 'apply' | 'evaluate') {
  const rules = new ThrowingStepRules(step);
  const engine = new GameEngine(
    MATCH_ID,
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
  return {
    cells: state.board.cells(),
    score: state.score,
    phase: phaseNameOf(engine.currentPhase()),
  };
}

const afterOneMove = { cells: [[square(0, 0), fakeCell(1)]], score: Score.of(1), phase: 'playing' };

describe('GameEngine edge cases', () => {
  it('should_keep_the_board_the_score_and_the_phase_when_apply_throws', () => {
    const { engine, rules } = armedGame('apply');

    expect(() => engine.play(place(1, 0))).toThrow('apply failed');

    expect(summary(engine)).toEqual(afterOneMove);
    rules.armed = false;
    expect(engine.play(place(1, 0))).toBe(Outcome.playing);
  });

  it('should_keep_the_board_the_score_and_the_phase_when_evaluate_throws', () => {
    const { engine, rules } = armedGame('evaluate');

    expect(() => engine.play(place(1, 0))).toThrow('evaluate failed');

    expect(summary(engine)).toEqual(afterOneMove);
    rules.armed = false;
    expect(engine.play(place(1, 0))).toBe(Outcome.playing);
  });

  // `play()` enters the resolving phase before it calls the rules and the scoring.
  // The resolving phase refuses a move, so a reentrant `play()` throws a RangeError.
  it('should_reject_a_reentrant_play_when_the_scoring_calls_play_during_a_turn', () => {
    const scoring = new ReentrantScoring();
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new FakeRules(),
      scoring,
      new RecordingPublisher(),
    );
    scoring.engine = engine;
    engine.start(emptyState());

    const outcome = engine.play(place(0, 0));

    expect(scoring.innerError).toBeInstanceOf(RangeError);
    expect(scoring.innerError).toEqual(
      new RangeError('The game cannot accept a move in the resolving phase.'),
    );
    expect(outcome).toBe(Outcome.playing);
    expect(summary(engine)).toEqual(afterOneMove);
  });

  it('should_start_a_new_game_when_start_runs_after_game_over', () => {
    const { engine, publisher } = newGame();
    engine.start(emptyState(1));
    engine.play(place(0, 0));

    engine.start(emptyState(1));

    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(engine.snapshot().board.cells()).toEqual([]);
    expect(engine.snapshot().score).toEqual(Score.of(0));
    expect(engine.play(place(0, 0))).toBe(Outcome.gameOver);
    expect(publisher.events).toHaveLength(2);
  });
});

// Rules whose `playTurn()` returns `resolution` for every move.
class FixedResolutionRules extends FakeRules {
  constructor(private readonly resolution: (state: FakeState) => Resolution) {
    super();
  }

  override playTurn(state: FakeState): Resolution {
    return this.resolution(state);
  }
}

// Rules whose `evaluate()` returns `outcome` for every move.
class FixedOutcomeRules extends FakeRules {
  constructor(private readonly outcome: Outcome) {
    super();
  }

  override evaluate(): Outcome {
    return this.outcome;
  }
}

// A scoring policy that builds the score of every move from `points`.
// `Score.of()` refuses a value that is not a valid score, so the policy throws inside the turn.
class FixedScoring extends OnePointScoring {
  constructor(private readonly points: number) {
    super();
  }

  override score(): Score {
    return Score.of(this.points);
  }
}

// A scoring policy that changes the photo it receives, then throws.
// The photo is frozen, so a cast reaches only its copy of the board.
class MutatingThrowingScoring extends OnePointScoring {
  override score(before: FakeSnapshot): Score {
    (before.board as Board<FakeCell, SquareCoord, SquareAxis>).occupy(square(1, 1), fakeCell(9));
    throw new Error('score failed');
  }
}

// A publisher that always throws.
class ThrowingPublisher extends RecordingPublisher {
  override publish(): void {
    throw new Error('publish failed');
  }
}

// Rules that draw from the piece source of the state (classes.md decision 31).
// The first `apply()` throws after the draw.
class DrawingRules extends SourceRules {
  private failed = false;

  override apply(state: SourceState, at: SquareCoord): SourceState {
    const next = super.apply(state, at);
    if (!this.failed) {
      this.failed = true;
      throw new Error('apply failed');
    }
    return next;
  }
}

// Rules whose `resolve()` rejects every move after `apply()` has drawn a piece.
class RejectingDrawRules extends SourceRules {
  rejecting = true;

  override resolve(state: SourceState): Resolution {
    return this.rejecting ? Resolution.rejected() : super.resolve(state);
  }
}

// A game whose state holds a fixed list of three pieces.
function sourceGame(rules: SourceRules) {
  const engine = new GameEngine(
    MATCH_ID,
    GameId.of('fake-game'),
    rules,
    { score: () => Score.of(1) },
    new RecordingPublisher(),
  );
  engine.start(sourceState(new FixedListPieceSource([fakeCell(1), fakeCell(2), fakeCell(3)])));
  return engine;
}

function gameWith(
  rules: FakeRules,
  scoring: OnePointScoring = new OnePointScoring(),
  publisher: RecordingPublisher = new RecordingPublisher(),
) {
  const engine = new GameEngine(MATCH_ID, GameId.of('fake-game'), rules, scoring, publisher);
  engine.start(emptyState());
  return { engine, publisher };
}

const initial = { cells: [], score: Score.of(0), phase: 'playing' };

describe('GameEngine review findings', () => {
  it('should_return_playing_when_the_rules_return_a_rejected_resolution_with_a_final_outcome', () => {
    // `Resolution.evaluated()` refuses a rejected resolution, so a structural copy stands in
    // for a custom `IGameRules` that returns a rejected resolution with a final outcome.
    const forged = () => ({ accepted: false, outcome: Outcome.victory }) as unknown as Resolution;
    const { engine, publisher } = gameWith(new FixedResolutionRules(forged));

    const outcome = engine.play(place(0, 0));

    expect(outcome).toBe(Outcome.playing);
    expect(summary(engine)).toEqual(initial);
    expect(publisher.events).toEqual([]);
    expect(engine.play(place(0, 0))).toBe(Outcome.playing);
  });

  it('should_keep_the_state_when_the_scoring_mutates_before_and_throws', () => {
    const { engine, publisher } = gameWith(new FakeRules(), new MutatingThrowingScoring());

    expect(() => engine.play(place(0, 0))).toThrow('score failed');

    expect(summary(engine)).toEqual(initial);
    expect(publisher.events).toEqual([]);
  });

  it('should_throw_and_keep_the_state_when_the_scoring_gives_a_score_that_is_not_valid', () => {
    for (const points of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5]) {
      const { engine, publisher } = gameWith(new FakeRules(), new FixedScoring(points));

      expect(() => engine.play(place(0, 0))).toThrow(
        new RangeError(`A score needs a whole number of 0 or more, not ${points}.`),
      );

      expect(summary(engine)).toEqual(initial);
      expect(publisher.events).toEqual([]);
    }
  });

  it('should_add_the_points_when_the_scoring_gives_a_valid_score', () => {
    const { engine } = gameWith(new FakeRules(), new FixedScoring(7));

    engine.play(place(0, 0));
    engine.play(place(0, 1));

    expect(engine.snapshot().score).toEqual(Score.of(14));
  });

  it('should_throw_a_range_error_and_keep_the_state_when_the_rules_return_an_unknown_outcome', () => {
    const { engine, publisher } = gameWith(new FixedOutcomeRules('draw' as unknown as Outcome));

    expect(() => engine.play(place(0, 0))).toThrow(new RangeError('Unknown outcome: draw.'));

    expect(summary(engine)).toEqual(initial);
    expect(publisher.events).toEqual([]);
  });

  // The engine commits the turn before it publishes. A throwing publisher cannot undo it.
  it('should_commit_the_turn_and_rethrow_when_the_publisher_throws', () => {
    const { engine } = gameWith(
      new FixedOutcomeRules(Outcome.gameOver),
      new OnePointScoring(),
      new ThrowingPublisher(),
    );

    expect(() => engine.play(place(0, 0))).toThrow('publish failed');

    expect(summary(engine)).toEqual({ ...afterOneMove, phase: 'game-over' });
  });

  // `tryPlay()` keeps the publisher failure apart from the outcome (issue 132, G117.2).
  // Since issue 210 it returns the `Resolution` of the turn, a domain value, and the publisher
  // failure goes to the handler of the caller (classes.md decision 48).
  it('should_return_the_resolution_and_give_the_publisher_failure_to_the_handler_when_try_play_saves_the_turn', () => {
    const { engine } = gameWith(
      new FixedOutcomeRules(Outcome.gameOver),
      new OnePointScoring(),
      new ThrowingPublisher(),
    );
    const failures: unknown[] = [];

    const turn = engine.tryPlay(place(0, 0), (error) => failures.push(error));

    expect(turn).toBeInstanceOf(Resolution);
    expect(turn.equals(Resolution.resolved().evaluated(Outcome.gameOver))).toBe(true);
    expect(failures).toEqual([new Error('publish failed')]);
    expect(summary(engine)).toEqual({ ...afterOneMove, phase: 'game-over' });
  });

  it('should_commit_the_turn_and_rethrow_when_the_publisher_throws_and_try_play_has_no_handler', () => {
    const { engine } = gameWith(
      new FixedOutcomeRules(Outcome.gameOver),
      new OnePointScoring(),
      new ThrowingPublisher(),
    );

    expect(() => engine.tryPlay(place(0, 0))).toThrow('publish failed');

    expect(summary(engine)).toEqual({ ...afterOneMove, phase: 'game-over' });
  });

  it('should_commit_the_turn_and_let_the_error_out_when_the_handler_of_try_play_throws', () => {
    const { engine } = gameWith(
      new FixedOutcomeRules(Outcome.gameOver),
      new OnePointScoring(),
      new ThrowingPublisher(),
    );
    const handler = () => {
      throw new Error('handler failed');
    };

    expect(() => engine.tryPlay(place(0, 0), handler)).toThrow('handler failed');

    expect(summary(engine)).toEqual({ ...afterOneMove, phase: 'game-over' });
  });

  it('should_not_call_the_handler_when_the_publisher_works', () => {
    const { engine, publisher } = gameWith(new FixedOutcomeRules(Outcome.gameOver));
    const failures: unknown[] = [];

    const turn = engine.tryPlay(place(0, 0), (error) => failures.push(error));

    expect(turn).toBeInstanceOf(Resolution);
    expect([turn.accepted, turn.outcome]).toEqual([true, Outcome.gameOver]);
    expect(failures).toEqual([]);
    expect(publisher.events).toHaveLength(1);
  });

  it('should_return_a_rejected_resolution_and_call_no_handler_when_the_rules_reject_the_move', () => {
    const { engine, publisher } = gameWith(new RejectingResolveRules());
    const failures: unknown[] = [];

    const turn = engine.tryPlay(place(0, 0), (error) => failures.push(error));

    expect(turn).toBeInstanceOf(Resolution);
    expect(turn.equals(Resolution.rejected())).toBe(true);
    expect([failures, publisher.events]).toEqual([[], []]);
  });

  // The rollback covers the board, the score, the phase and the piece source in the state.
  it('should_draw_the_same_piece_when_a_turn_is_retried_after_a_throw', () => {
    const engine = sourceGame(new DrawingRules());

    expect(() => engine.play(square(0, 0))).toThrow('apply failed');
    expect(engine.snapshot().board.cells()).toEqual([]);
    expect(engine.snapshot().score).toEqual(Score.of(0));
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);

    expect(engine.play(square(0, 0))).toBe(Outcome.playing);
    expect(engine.snapshot().board.get(square(0, 0))).toEqual(fakeCell(1));
    expect([...engine.snapshot().source]).toEqual([fakeCell(2), fakeCell(3)]);
  });

  it('should_keep_the_source_position_when_the_rules_reject_a_move_after_apply', () => {
    const rules = new RejectingDrawRules();
    const engine = sourceGame(rules);

    expect(engine.play(square(0, 0))).toBe(Outcome.playing);
    expect(engine.snapshot().board.cells()).toEqual([]);
    expect([...engine.snapshot().source]).toEqual([fakeCell(1), fakeCell(2), fakeCell(3)]);

    rules.rejecting = false;
    expect(engine.play(square(0, 0))).toBe(Outcome.playing);
    expect(engine.snapshot().board.get(square(0, 0))).toEqual(fakeCell(1));
  });

  it('should_publish_game_over_with_the_victory_outcome_when_the_rules_return_victory', () => {
    const { engine, publisher } = gameWith(new FixedOutcomeRules(Outcome.victory));

    const outcome = engine.play(place(0, 0));

    expect(outcome).toBe(Outcome.victory);
    expect(engine.currentPhase()).toBe(VictoryPhase.instance);
    expect(publisher.events).toHaveLength(1);
    const event = publisher.events[0] as GameOver;
    expect(event).toBeInstanceOf(GameOver);
    expect(event.gameId.equals(GameId.of('fake-game'))).toBe(true);
    expect(event.outcome).toBe(Outcome.victory);
    expect(event.finalScore).toEqual(Score.of(1));
  });

  it('should_throw_when_pause_is_called_before_start', () => {
    const { engine } = newGame();

    expect(() => engine.pause()).toThrow(new RangeError('The game has not started.'));

    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
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

describe('GameEngine.currentPhase()', () => {
  it('should_answer_the_phase_through_a_method_when_the_game_moves_to_its_end', () => {
    const { engine } = newGame();
    engine.start(emptyState());

    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(engine.currentPhase().canPlay()).toBe(true);

    [place(0, 0), place(1, 0), place(0, 1), place(1, 1)].forEach((move) => engine.play(move));

    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
    expect(engine.currentPhase().canPlay()).toBe(false);
    expect('phase' in engine).toBe(false);
  });
});

// The identity of the aggregate root (classes.md decisions 26 and 30). `GameId` names the variant,
// so two matches of one variant have the same `GameId`, and only the `MatchId` tells them apart.
function matchOf(id: MatchId, size = 2) {
  const publisher = new RecordingPublisher();
  const engine = new GameEngine(
    id,
    GameId.of('fake-game'),
    new FakeRules(),
    new OnePointScoring(),
    publisher,
  );
  engine.start(emptyState(size, id));
  return { engine, publisher };
}

describe('GameEngine identity', () => {
  it('should_be_the_same_game_when_two_engines_have_the_same_match_id_whatever_their_boards_hold', () => {
    const first = matchOf(MatchId.of('match-a')).engine;
    const second = matchOf(MatchId.of('match-a'), 3).engine;
    first.play(place(0, 0));

    expect(first.snapshot().board.cells()).not.toEqual(second.snapshot().board.cells());
    expect([first.equals(second), second.equals(first), first.equals(first)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_another_game_when_two_engines_of_one_variant_have_different_match_ids', () => {
    const first = matchOf(MatchId.of('match-a')).engine;
    const second = matchOf(MatchId.of('match-b')).engine;

    expect(first.snapshot().board.cells()).toEqual(second.snapshot().board.cells());
    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
  });

  it('should_keep_its_identity_when_the_game_plays_pauses_and_starts_again', () => {
    const { engine } = matchOf(MatchId.of('match-a'));
    const same = matchOf(MatchId.of('match-a')).engine;

    engine.play(place(0, 0));
    engine.pause();
    engine.start(emptyState(2, MatchId.of('match-a')));

    expect(engine.equals(same)).toBe(true);
  });

  // The state takes its identity from the game, so the game refuses a state of another match.
  it('should_throw_a_range_error_and_keep_the_game_when_the_first_state_belongs_to_another_match', () => {
    const { engine } = matchOf(MatchId.of('match-a'));
    engine.play(place(0, 0));
    const before = engine.snapshot();

    expect(() => engine.start(emptyState(2, MatchId.of('match-b')))).toThrow(
      new RangeError('The first state belongs to another match.'),
    );
    expect(engine.snapshot().board.cells()).toEqual(before.board.cells());
    expect(engine.snapshot().score).toEqual(Score.of(1));
    expect(engine.snapshot().matchId.equals(MatchId.of('match-a'))).toBe(true);
  });

  it('should_keep_the_identity_of_the_match_in_every_state_when_the_game_plays', () => {
    const { engine } = matchOf(MatchId.of('match-a'));

    engine.play(place(0, 0));
    engine.play(place(1, 0));

    expect(engine.snapshot().matchId.equals(MatchId.of('match-a'))).toBe(true);
    expect(
      engine.snapshot().stateId.equals(emptyState(2, MatchId.of('match-a')).snapshot().stateId),
    ).toBe(true);
  });

  it('should_publish_game_over_with_the_variant_id_and_the_match_id_when_the_game_ends', () => {
    const { engine, publisher } = matchOf(MatchId.of('match-a'), 1);

    engine.play(place(0, 0));

    const event = publisher.events[0] as GameOver;
    expect(publisher.events).toHaveLength(1);
    expect(event.gameId.equals(GameId.of('fake-game'))).toBe(true);
    expect(event.matchId.equals(MatchId.of('match-a'))).toBe(true);
    expect(event.matchId.equals(MatchId.of('match-b'))).toBe(false);
  });
});
