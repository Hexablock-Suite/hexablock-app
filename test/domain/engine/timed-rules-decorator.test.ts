/** @jest-environment node */
import { ElapsedTime } from '../../../src/domain/engine/elapsed-time';
import { Score } from '../../../src/domain/engine/score';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameId } from '../../../src/domain/engine/game-id';
import { GameOverPhase, PlayingPhase } from '../../../src/domain/engine/game-phase';
import { LevelTimer } from '../../../src/domain/engine/level-timer';
import { LevelTimerId } from '../../../src/domain/engine/level-timer-id';
import { Outcome } from '../../../src/domain/engine/outcome';
import type { IScoringPolicy } from '../../../src/domain/engine/scoring-policy';
import { TimedRulesDecorator } from '../../../src/domain/engine/timed-rules-decorator';
import { fakeCell, type FakeCell } from '../../support/engine/fake-cell';
import {
  emptyState,
  FakeRules,
  OnePointScoring,
  RecordingPublisher,
  type FakeMove,
  type FakeState,
  type FakeSnapshot,
} from '../../support/engine/fake-game';
import { ManualClock } from '../../support/engine/manual-clock';
import { phaseNameOf } from '../../support/engine/phase-name';
import { square, squareTopology, type SquareCoord } from '../../support/engine/square-topology';
import { MATCH_ID } from '../../support/engine/match-id';
import { TIMER_ID } from '../../support/engine/entity-ids';

// `TimedRulesDecorator` times a game around any rules (issue 157, classes.md decision 19, D14).
// `FakeRules` extends `BaseGameRules` and calls its own `evaluate()`, as a variant rules class does.
// A full board ends this fake game with `game-over`.

const moveAt = (col: number, row = 0): FakeMove => ({
  at: square(col, row),
  cell: fakeCell(col + 1),
});
const outsideTheBoard = moveAt(9);

// One second of play in each gap, so a wrong reading gives a wrong sum.
const SECOND = 1_000;

function timedGame(
  size = 2,
  scoring: IScoringPolicy<FakeState> = new OnePointScoring(),
  rules = new FakeRules(),
) {
  const clock = new ManualClock();
  const timer = new LevelTimer(TIMER_ID, clock);
  const decorated = new TimedRulesDecorator(rules, timer);
  const engine = new GameEngine(
    MATCH_ID,
    GameId.of('fake-game'),
    decorated,
    scoring,
    new RecordingPublisher(),
  );
  engine.start(emptyState(size));
  return { clock, timer, decorated, engine, rules };
}

// A scoring that throws the first time a turn ends the game, after the rules have run.
class ThrowsOnFirstEnd implements IScoringPolicy<FakeState> {
  private thrown = false;

  // The fake game ends when the board is full, so the photo after the turn shows the end.
  score(_before: FakeSnapshot, after: FakeSnapshot): Score {
    const ended = after.board.cells().length === after.board.shape.cells.length;
    if (ended && !this.thrown) {
      this.thrown = true;
      throw new Error('The scoring failed.');
    }
    return Score.of(0);
  }
}

// The plain facts of a run: the filled keys, the score, the phase and each step of the rules.
function factsOf(
  engine: GameEngine<FakeCell, SquareCoord, FakeMove, FakeState>,
  rules: FakeRules,
  outcomes: Outcome[],
) {
  const state = engine.snapshot();
  return {
    cells: state.board.cells().map(([at, cell]) => [squareTopology.key(at), cell.value]),
    score: state.score,
    phase: phaseNameOf(engine.currentPhase()),
    log: rules.log,
    outcomes,
  };
}

describe('TimedRulesDecorator', () => {
  it('should_read_zero_when_no_turn_has_run', () => {
    const { clock, timer } = timedGame();

    clock.advance(5 * SECOND);

    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(0));
  });

  it('should_time_the_game_from_the_first_turn_when_the_clock_moves_between_turns', () => {
    const { clock, timer, engine } = timedGame();
    // The time before the first turn does not count.
    clock.advance(9 * SECOND);

    engine.play(moveAt(0));
    const atFirstTurn = timer.elapsedMs();
    clock.advance(SECOND);
    const afterOneSecond = timer.elapsedMs();
    engine.play(moveAt(1));
    clock.advance(SECOND);

    expect(atFirstTurn).toEqual(ElapsedTime.ofMs(0));
    expect(afterOneSecond).toEqual(ElapsedTime.ofMs(SECOND));
    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(2 * SECOND));
  });

  it('should_stop_the_timer_and_keep_the_time_when_the_turn_ends_the_game', () => {
    const game = timedGame();
    game.engine.play(moveAt(0));
    game.clock.advance(3 * SECOND);
    game.engine.play(moveAt(1));
    game.engine.play(moveAt(0, 1));

    const last = game.engine.play(moveAt(1, 1));
    game.clock.advance(4 * SECOND);

    expect(last).toBe(Outcome.gameOver);
    expect(game.timer.elapsedMs()).toEqual(ElapsedTime.ofMs(3 * SECOND));
  });

  it('should_read_zero_when_one_turn_starts_and_ends_the_game', () => {
    const { clock, timer, engine } = timedGame(1);

    const outcome = engine.play(moveAt(0));
    clock.advance(SECOND);

    expect(outcome).toBe(Outcome.gameOver);
    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(0));
  });

  it('should_leave_the_timer_alone_when_the_first_move_is_rejected', () => {
    const { clock, timer, engine } = timedGame();
    clock.advance(SECOND);

    const turn = engine.tryPlay(outsideTheBoard);
    clock.advance(2 * SECOND);
    const afterRejected = timer.elapsedMs();
    engine.play(moveAt(0));
    clock.advance(SECOND);

    expect(turn.accepted).toBe(false);
    expect(afterRejected).toEqual(ElapsedTime.ofMs(0));
    // The first accepted turn starts the timer.
    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(SECOND));
  });

  it('should_keep_the_timer_running_when_a_later_move_is_rejected', () => {
    const { clock, timer, engine } = timedGame();
    engine.play(moveAt(0));
    clock.advance(SECOND);

    const turn = engine.tryPlay(outsideTheBoard);
    clock.advance(SECOND);

    expect(turn.accepted).toBe(false);
    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(2 * SECOND));
  });

  it('should_keep_the_timer_running_when_evaluate_reads_a_finished_state_outside_a_turn', () => {
    const { clock, timer, engine, decorated } = timedGame();
    engine.play(moveAt(0));
    const finished = emptyState(1);
    finished.board.occupy(square(0, 0), fakeCell(1));

    const outcome = decorated.evaluate(finished);
    clock.advance(SECOND);

    expect(outcome).toBe(Outcome.gameOver);
    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(SECOND));
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
  });

  it('should_time_the_retried_turn_when_the_engine_rolls_back_the_last_turn', () => {
    const { clock, timer, engine } = timedGame(2, new ThrowsOnFirstEnd());
    engine.play(moveAt(0));
    engine.play(moveAt(1));
    engine.play(moveAt(0, 1));
    clock.advance(SECOND);

    expect(() => engine.play(moveAt(1, 1))).toThrow('The scoring failed.');
    clock.advance(2 * SECOND);
    const retried = engine.play(moveAt(1, 1));
    clock.advance(SECOND);

    // The rollback keeps the game going, so the end of the game is the retried turn.
    expect(retried).toBe(Outcome.gameOver);
    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(3 * SECOND));
  });

  // A clock can give a fraction of a millisecond. An `ElapsedTime` is a whole number
  // of milliseconds, so the timer drops the fraction (issue #204).
  it('should_read_whole_milliseconds_when_the_clock_gives_a_fraction', () => {
    const { clock, timer, engine } = timedGame();
    engine.play(moveAt(0));

    clock.advance(1_500.75);

    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(1_500));
  });

  it('should_give_an_elapsed_time_value_object_when_the_timer_is_read', () => {
    const { clock, timer, engine } = timedGame();
    const before = timer.elapsedMs();
    engine.play(moveAt(0));
    clock.advance(SECOND);

    expect(before).toBeInstanceOf(ElapsedTime);
    expect(timer.elapsedMs()).toBeInstanceOf(ElapsedTime);
    expect(timer.elapsedMs().equals(ElapsedTime.ofMs(SECOND))).toBe(true);
  });

  it('should_read_zero_and_never_a_negative_time_when_the_clock_goes_back', () => {
    const { clock, timer, engine } = timedGame();
    engine.play(moveAt(0));

    clock.advance(-SECOND);

    expect(timer.elapsedMs()).toEqual(ElapsedTime.ofMs(0));
  });

  it('should_play_the_same_game_as_the_inner_rules_when_the_rules_are_decorated', () => {
    const plainRules = new FakeRules();
    const plain = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      plainRules,
      new OnePointScoring(),
      new RecordingPublisher(),
    );
    plain.start(emptyState(1));
    const timed = timedGame(1);

    const plainOutcomes = [plain.play(moveAt(0))];
    const timedOutcomes = [timed.engine.play(moveAt(0))];

    expect(factsOf(timed.engine, timed.rules, timedOutcomes)).toEqual(
      factsOf(plain, plainRules, plainOutcomes),
    );
    expect(timed.rules.log).toEqual(['isValid', 'apply', 'resolve', 'evaluate']);
  });

  it('should_answer_as_the_inner_rules_when_each_step_is_asked_directly', () => {
    const { decorated, rules } = timedGame();
    const state = emptyState();
    const move = moveAt(0);

    expect(decorated.isValid(state, move)).toBe(rules.isValid(state, move));
    expect(decorated.isValid(state, outsideTheBoard)).toBe(false);
    expect([...decorated.validMoves(state)]).toEqual([...rules.validMoves(state)]);
    expect(decorated.apply(emptyState(), move).board.cells()).toEqual(
      rules.apply(emptyState(), move).board.cells(),
    );
    expect(decorated.resolve(state).accepted).toBe(true);
    expect(decorated.evaluate(state)).toBe(Outcome.playing);
  });
});

// The timer is an entity inside the aggregate (issue #214, classes.md decisions 19 and 26).
// Its `LevelTimerId` is its identity, so the readings of the clock do not count.
describe('LevelTimer.equals', () => {
  it('should_be_equal_in_both_directions_when_two_timers_hold_one_id_and_only_one_is_started', () => {
    const clock = new ManualClock();
    const started = new LevelTimer(LevelTimerId.of('timer-a'), clock);
    const idle = new LevelTimer(LevelTimerId.of('timer-a'), new ManualClock());
    started.start();
    clock.advance(SECOND);

    expect(started.elapsedMs()).toEqual(ElapsedTime.ofMs(SECOND));
    expect(idle.elapsedMs()).toEqual(ElapsedTime.ofMs(0));
    expect([started.equals(idle), idle.equals(started), started.equals(started)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('should_be_different_in_both_directions_when_two_timers_hold_different_ids_and_read_one_clock', () => {
    const clock = new ManualClock();
    const first = new LevelTimer(LevelTimerId.of('timer-a'), clock);
    const second = new LevelTimer(LevelTimerId.of('timer-b'), clock);
    first.start();
    second.start();
    clock.advance(SECOND);

    expect(first.elapsedMs()).toEqual(second.elapsedMs());
    expect([first.equals(second), second.equals(first)]).toEqual([false, false]);
  });

  it('should_keep_its_identity_when_the_timer_starts_and_stops', () => {
    const clock = new ManualClock();
    const timer = new LevelTimer(LevelTimerId.of('timer-a'), clock);
    const same = new LevelTimer(LevelTimerId.of('timer-a'), clock);
    const other = new LevelTimer(LevelTimerId.of('timer-b'), clock);

    timer.start();
    clock.advance(SECOND);
    timer.stop();

    expect([timer.equals(same), timer.equals(other)]).toEqual([true, false]);
  });
});

describe('GameEngine.timed', () => {
  it('should_return_the_timer_when_the_rules_are_timed', () => {
    const { engine, timer } = timedGame();

    expect(engine.timed()).toBe(timer);
  });

  it('should_return_undefined_when_the_rules_have_no_timer', () => {
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new FakeRules(),
      new OnePointScoring(),
      new RecordingPublisher(),
    );

    expect(engine.timed()).toBeUndefined();
  });
});
