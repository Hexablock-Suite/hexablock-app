/** @jest-environment node */
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameId } from '../../../src/domain/engine/game-id';
import { GameOverPhase, PlayingPhase } from '../../../src/domain/engine/game-phase';
import { LevelTimer } from '../../../src/domain/engine/level-timer';
import type { Outcome } from '../../../src/domain/engine/outcome';
import type { Resolution } from '../../../src/domain/engine/resolution';
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
} from '../../support/engine/fake-game';
import { ManualClock } from '../../support/engine/manual-clock';
import { phaseNameOf } from '../../support/engine/phase-name';
import { square, squareTopology, type SquareCoord } from '../../support/engine/square-topology';

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
  const timer = new LevelTimer(clock);
  const decorated = new TimedRulesDecorator(rules, timer);
  const engine = new GameEngine(
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

  score(_before: FakeState, resolution: Resolution<FakeState>): number {
    if (resolution.outcome !== 'playing' && !this.thrown) {
      this.thrown = true;
      throw new Error('The scoring failed.');
    }
    return 0;
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

    expect(timer.elapsedMs()).toBe(0);
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

    expect(atFirstTurn).toBe(0);
    expect(afterOneSecond).toBe(SECOND);
    expect(timer.elapsedMs()).toBe(2 * SECOND);
  });

  it('should_stop_the_timer_and_keep_the_time_when_the_turn_ends_the_game', () => {
    const game = timedGame();
    game.engine.play(moveAt(0));
    game.clock.advance(3 * SECOND);
    game.engine.play(moveAt(1));
    game.engine.play(moveAt(0, 1));

    const last = game.engine.play(moveAt(1, 1));
    game.clock.advance(4 * SECOND);

    expect(last).toBe('game-over');
    expect(game.timer.elapsedMs()).toBe(3 * SECOND);
  });

  it('should_read_zero_when_one_turn_starts_and_ends_the_game', () => {
    const { clock, timer, engine } = timedGame(1);

    const outcome = engine.play(moveAt(0));
    clock.advance(SECOND);

    expect(outcome).toBe('game-over');
    expect(timer.elapsedMs()).toBe(0);
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
    expect(afterRejected).toBe(0);
    // The first accepted turn starts the timer.
    expect(timer.elapsedMs()).toBe(SECOND);
  });

  it('should_keep_the_timer_running_when_a_later_move_is_rejected', () => {
    const { clock, timer, engine } = timedGame();
    engine.play(moveAt(0));
    clock.advance(SECOND);

    const turn = engine.tryPlay(outsideTheBoard);
    clock.advance(SECOND);

    expect(turn.accepted).toBe(false);
    expect(timer.elapsedMs()).toBe(2 * SECOND);
  });

  it('should_keep_the_timer_running_when_evaluate_reads_a_finished_state_outside_a_turn', () => {
    const { clock, timer, engine, decorated } = timedGame();
    engine.play(moveAt(0));
    const finished = emptyState(1);
    finished.board.set(square(0, 0), fakeCell(1));

    const outcome = decorated.evaluate(finished);
    clock.advance(SECOND);

    expect(outcome).toBe('game-over');
    expect(timer.elapsedMs()).toBe(SECOND);
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
    expect(retried).toBe('game-over');
    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
    expect(timer.elapsedMs()).toBe(3 * SECOND);
  });

  it('should_read_zero_and_never_a_negative_time_when_the_clock_goes_back', () => {
    const { clock, timer, engine } = timedGame();
    engine.play(moveAt(0));

    clock.advance(-SECOND);

    expect(timer.elapsedMs()).toBe(0);
  });

  it('should_play_the_same_game_as_the_inner_rules_when_the_rules_are_decorated', () => {
    const plainRules = new FakeRules();
    const plain = new GameEngine(
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
    expect(decorated.evaluate(state)).toBe('playing');
  });
});

describe('GameEngine.timed', () => {
  it('should_return_the_timer_when_the_rules_are_timed', () => {
    const { engine, timer } = timedGame();

    expect(engine.timed()).toBe(timer);
  });

  it('should_return_undefined_when_the_rules_have_no_timer', () => {
    const engine = new GameEngine(
      GameId.of('fake-game'),
      new FakeRules(),
      new OnePointScoring(),
      new RecordingPublisher(),
    );

    expect(engine.timed()).toBeUndefined();
  });
});
