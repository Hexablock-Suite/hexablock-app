/** @jest-environment node */
import { ElapsedTime } from '../../../src/domain/shared/elapsed-time';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameId } from '../../../src/domain/shared/game-id';
import { GameOverPhase, PausedPhase, PlayingPhase } from '../../../src/domain/engine/game-phase';
import { LevelTimer } from '../../../src/domain/engine/level-timer';
import { MoveHistory } from '../../../src/domain/engine/move-history';
import { Outcome } from '../../../src/domain/engine/outcome';
import { TimedRulesDecorator } from '../../../src/domain/engine/timed-rules-decorator';
import { fakeCell } from '../../support/engine/fake-cell';
import {
  emptyState,
  FakeRules,
  OnePointScoring,
  type FakeMove,
  type FakeSnapshot,
} from '../../support/engine/fake-game';
import { ManualClock } from '../../support/engine/manual-clock';
import { square } from '../../support/engine/square-topology';
import { MATCH_ID } from '../../support/engine/match-id';
import { TIMER_ID } from '../../support/engine/entity-ids';
import { playMove } from '../../support/engine/play-move';

// A pause stops the clock of a timed game (issue #428, option A1, classes.md decision 19).
// The root tells its timer about a pause and a resume, and `elapsedTime()` leaves out
// the paused span. A full board ends this fake game with `game-over`.

const moveAt = (col: number, row = 0): FakeMove => ({
  at: square(col, row),
  cell: fakeCell(col + 1),
});

// One second of play in each gap, so a wrong reading gives a wrong sum.
const SECOND = 1_000;

// A timed game with an undo history, as `GameFactory` builds a Fit game.
function timedGame(size = 2) {
  const clock = new ManualClock();
  const timer = new LevelTimer(TIMER_ID, clock);
  const engine = new GameEngine(
    MATCH_ID,
    GameId.of('fake-game'),
    new TimedRulesDecorator(new FakeRules(), timer),
    new OnePointScoring(),
    new MoveHistory<FakeMove, FakeSnapshot>(),
    timer,
  );
  engine.start(emptyState(size));
  return { clock, engine };
}

describe('GameEngine pause and the timer', () => {
  it('should_leave_the_paused_span_out_of_the_time_when_a_timed_game_pauses_and_resumes', () => {
    const { clock, engine } = timedGame();
    playMove(engine, moveAt(0));
    clock.advance(SECOND);

    engine.pause();
    clock.advance(5 * SECOND);
    const whilePaused = engine.elapsedTime();
    engine.resume();
    clock.advance(2 * SECOND);

    expect(whilePaused).toEqual(ElapsedTime.ofMs(SECOND));
    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(3 * SECOND));
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
  });

  it('should_leave_every_paused_span_out_when_the_game_pauses_twice', () => {
    const { clock, engine } = timedGame();
    playMove(engine, moveAt(0));
    clock.advance(SECOND);
    engine.pause();
    clock.advance(4 * SECOND);
    engine.resume();
    clock.advance(SECOND);
    engine.pause();
    clock.advance(6 * SECOND);
    engine.resume();
    clock.advance(SECOND);

    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(3 * SECOND));
  });

  it('should_count_from_the_first_turn_when_the_game_pauses_before_the_first_turn', () => {
    const { clock, engine } = timedGame();

    engine.pause();
    clock.advance(5 * SECOND);
    engine.resume();
    clock.advance(SECOND);
    const beforeTheFirstTurn = engine.elapsedTime();
    playMove(engine, moveAt(0));
    clock.advance(2 * SECOND);

    expect(beforeTheFirstTurn).toEqual(ElapsedTime.ofMs(0));
    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(2 * SECOND));
  });

  it('should_keep_the_first_pause_when_the_game_is_paused_twice_in_a_row', () => {
    const { clock, engine } = timedGame();
    playMove(engine, moveAt(0));
    clock.advance(SECOND);

    engine.pause();
    clock.advance(2 * SECOND);
    engine.pause();
    clock.advance(3 * SECOND);
    engine.resume();
    clock.advance(SECOND);

    // The second pause starts no new span: the whole pause of 5 seconds stays out.
    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(2 * SECOND));
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
  });

  it('should_keep_the_clock_running_when_a_playing_game_resumes', () => {
    const { clock, engine } = timedGame();
    playMove(engine, moveAt(0));
    clock.advance(SECOND);

    engine.resume();
    clock.advance(SECOND);

    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(2 * SECOND));
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
  });

  it('should_keep_the_final_time_when_an_ended_game_pauses_and_resumes', () => {
    const { clock, engine } = timedGame();
    playMove(engine, moveAt(0));
    clock.advance(3 * SECOND);
    playMove(engine, moveAt(1));
    playMove(engine, moveAt(0, 1));
    const last = playMove(engine, moveAt(1, 1));

    engine.pause();
    clock.advance(2 * SECOND);
    engine.resume();
    clock.advance(4 * SECOND);

    expect(last).toBe(Outcome.gameOver);
    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(3 * SECOND));
    expect(engine.currentPhase()).toBe(GameOverPhase.instance);
  });

  it('should_keep_the_clock_paused_when_an_undo_is_refused_during_the_pause', () => {
    const { clock, engine } = timedGame();
    playMove(engine, moveAt(0));
    clock.advance(SECOND);
    playMove(engine, moveAt(1));
    engine.pause();
    clock.advance(2 * SECOND);

    expect(() => engine.undo()).toThrow(
      new RangeError('The game cannot accept an undo in the paused phase.'),
    );
    clock.advance(2 * SECOND);
    const whilePaused = engine.elapsedTime();
    engine.resume();
    engine.undo();
    clock.advance(SECOND);

    expect(whilePaused).toEqual(ElapsedTime.ofMs(SECOND));
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    // An undo takes the move back, and the clock goes on (decision 19).
    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(2 * SECOND));
  });

  // The implementer's answer to the open question of #428: a second `start()` puts the game
  // back in the playing phase, so it also resumes the timer. It keeps the time of play
  // so far, because the timer counts from the first accepted turn of the match.
  it('should_resume_the_timer_and_keep_the_time_when_a_paused_game_starts_again', () => {
    const { clock, engine } = timedGame();
    playMove(engine, moveAt(0));
    clock.advance(SECOND);
    engine.pause();
    clock.advance(4 * SECOND);

    engine.start(emptyState(2));
    clock.advance(2 * SECOND);

    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(engine.elapsedTime()).toEqual(ElapsedTime.ofMs(3 * SECOND));
  });

  it('should_pause_and_resume_with_no_time_when_the_game_has_no_timer', () => {
    const engine = new GameEngine(
      MATCH_ID,
      GameId.of('fake-game'),
      new FakeRules(),
      new OnePointScoring(),
    );
    engine.start(emptyState());
    playMove(engine, moveAt(0));

    engine.pause();
    const paused = engine.currentPhase();
    engine.resume();

    expect(paused).toBe(PausedPhase.instance);
    expect(engine.currentPhase()).toBe(PlayingPhase.instance);
    expect(engine.elapsedTime()).toBeUndefined();
  });
});
