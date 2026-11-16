/** @jest-environment node */
import { MoveCommand } from '../../../src/domain/engine/move-command';
import { RedoableHistory } from '../../../src/domain/engine/redoable-history';

// Issue #178: `RedoableHistory` is the history of Hexa Fit. It undoes with no limit, as
// `MoveHistory` does, and it keeps each undone command, so a redo plays it again
// (classes.md decisions 3 and 4). A test state is a plain string, because the history never
// reads the state. Each command of a move from `x` keeps `x` before and `x'` after the move.

function newHistory() {
  const restored: string[] = [];
  const history = new RedoableHistory<string, string>();
  const record = (...states: string[]) => {
    for (const before of states) {
      history.record(
        new MoveCommand(`move from ${before}`, before, `${before}'`, (memento) => {
          restored.push(memento);
        }),
      );
    }
  };
  return { history, record, restored };
}

describe('RedoableHistory', () => {
  it('should_give_back_the_state_after_each_undone_move_newest_first_when_redo_runs', () => {
    const { history, record, restored } = newHistory();
    record('a', 'b');
    history.undo();
    history.undo();
    restored.length = 0;

    expect(history.canRedo()).toBe(true);
    history.redo();

    expect(restored).toEqual(["a'"]);
    expect([history.canUndo(), history.canRedo()]).toEqual([true, true]);

    history.redo();

    expect(restored).toEqual(["a'", "b'"]);
    expect([history.canUndo(), history.canRedo()]).toEqual([true, false]);
  });

  it('should_undo_a_redone_move_again_when_undo_runs_after_redo', () => {
    const { history, record, restored } = newHistory();
    record('a');
    history.undo();
    history.redo();
    restored.length = 0;

    history.undo();

    expect(restored).toEqual(['a']);
    expect([history.canUndo(), history.canRedo()]).toEqual([false, true]);
  });

  it('should_keep_every_undone_move_when_many_moves_are_undone', () => {
    const { history, record, restored } = newHistory();
    const states = Array.from({ length: 50 }, (_, index) => `state ${index}`);
    record(...states);
    while (history.canUndo()) history.undo();
    restored.length = 0;

    while (history.canRedo()) history.redo();

    expect(restored).toEqual(states.map((state) => `${state}'`));
    expect(history.canUndo()).toBe(true);
  });

  it('should_forget_the_undone_moves_when_a_new_move_is_recorded', () => {
    const { history, record, restored } = newHistory();
    record('a', 'b');
    history.undo();

    record('c');

    expect(history.canRedo()).toBe(false);
    expect(() => history.redo()).toThrow(new RangeError('The history has no move to redo.'));
    expect(restored).toEqual(['b']);
  });

  it('should_forget_the_undone_moves_when_the_history_is_cleared', () => {
    const { history, record, restored } = newHistory();
    record('a', 'b');
    history.undo();

    history.clear();

    expect([history.canUndo(), history.canRedo()]).toEqual([false, false]);
    expect(() => history.redo()).toThrow(new RangeError('The history has no move to redo.'));
    expect(restored).toEqual(['b']);
  });

  it('should_throw_a_range_error_and_give_back_nothing_when_redo_runs_with_no_undone_move', () => {
    const { history, record, restored } = newHistory();
    record('a');

    expect(history.canRedo()).toBe(false);
    expect(() => history.redo()).toThrow(new RangeError('The history has no move to redo.'));
    expect(restored).toEqual([]);
    expect(history.canUndo()).toBe(true);
  });

  it('should_keep_the_undone_command_when_the_engine_refuses_to_take_the_state_back', () => {
    const history = new RedoableHistory<string, string>();
    let refuse = false;
    const restored: string[] = [];
    history.record(
      new MoveCommand('move', 'a', "a'", (memento) => {
        if (refuse) throw new RangeError('The engine is paused.');
        restored.push(memento);
      }),
    );
    history.undo();
    refuse = true;

    expect(() => history.redo()).toThrow(new RangeError('The engine is paused.'));
    expect([history.canUndo(), history.canRedo()]).toEqual([false, true]);

    refuse = false;
    history.redo();

    expect(restored).toEqual(['a', "a'"]);
    expect([history.canUndo(), history.canRedo()]).toEqual([true, false]);
  });

  it('should_give_itself_as_the_redo_capability_when_the_engine_asks_for_it', () => {
    const history = new RedoableHistory<string, string>();

    expect(history.redoable()).toBe(history);
  });
});
