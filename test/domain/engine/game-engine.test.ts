/** @jest-environment node */
import { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameOver } from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/engine/game-id';
import { fakeCell } from '../../support/engine/fake-cell';
import {
  emptyState,
  FakeRules,
  OnePointScoring,
  RecordingPublisher,
  type FakeMove,
} from '../../support/engine/fake-game';
import { square } from '../../support/engine/square-topology';

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
});
