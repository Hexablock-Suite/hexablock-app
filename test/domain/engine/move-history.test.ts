/** @jest-environment node */
import { MoveCommand } from '../../../src/domain/engine/history/move-command';
import { MoveHistory } from '../../../src/domain/engine/history/move-history';
import { UndoLimit } from '../../../src/domain/engine/history/undo-limit';

// `MoveHistory` is the Command invoker and the Memento caretaker (classes.md decisions 3 and 34).
// A test state is a plain string, because the history never reads the state.

function newHistory(limit?: UndoLimit) {
  const restored: string[] = [];
  const history = new MoveHistory<string, string>(limit);
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

describe('MoveHistory', () => {
  it('should_give_back_the_state_of_the_newest_command_when_undo_runs', () => {
    const { history, record, restored } = newHistory();
    record('a', 'b');

    history.undo();

    expect(restored).toEqual(['b']);
    expect(history.canUndo()).toBe(true);

    history.undo();

    expect(restored).toEqual(['b', 'a']);
    expect(history.canUndo()).toBe(false);
  });

  it('should_keep_only_the_newest_commands_when_the_history_has_a_limit', () => {
    const { history, record, restored } = newHistory(UndoLimit.of(2));
    record('a', 'b', 'c');

    history.undo();
    history.undo();

    expect(restored).toEqual(['c', 'b']);
    expect(history.canUndo()).toBe(false);
  });

  it('should_keep_every_command_when_the_history_has_no_limit', () => {
    const { history, record, restored } = newHistory();
    const states = Array.from({ length: 50 }, (_, index) => `state ${index}`);
    record(...states);

    while (history.canUndo()) history.undo();

    expect(restored).toEqual([...states].reverse());
  });

  // Issue #243: the limit is an `UndoLimit`, which checks its number in `UndoLimit.of()`.
  // Merge keeps one move (classes.md decision 3).
  it('should_keep_only_the_newest_command_when_the_history_has_a_limit_of_one', () => {
    const { history, record, restored } = newHistory(UndoLimit.of(1));
    record('a', 'b', 'c');

    history.undo();

    expect(restored).toEqual(['c']);
    expect(history.canUndo()).toBe(false);
  });

  it('should_throw_a_range_error_and_give_back_nothing_when_undo_runs_on_an_empty_history', () => {
    const { history, restored } = newHistory();

    expect(() => history.undo()).toThrow(new RangeError('The history has no move to undo.'));
    expect(restored).toEqual([]);
    expect(history.canUndo()).toBe(false);
  });

  it('should_keep_the_command_when_the_engine_refuses_to_take_the_state_back', () => {
    const history = new MoveHistory<string, string>();
    let refuse = true;
    const restored: string[] = [];
    history.record(
      new MoveCommand('move', 'a', "a'", (memento) => {
        if (refuse) throw new RangeError('The engine is paused.');
        restored.push(memento);
      }),
    );

    expect(() => history.undo()).toThrow(new RangeError('The engine is paused.'));
    expect(history.canUndo()).toBe(true);

    refuse = false;
    history.undo();

    expect(restored).toEqual(['a']);
    expect(history.canUndo()).toBe(false);
  });

  it('should_forget_every_command_when_the_history_is_cleared', () => {
    const { history, record, restored } = newHistory();
    record('a', 'b');

    history.clear();

    expect(history.canUndo()).toBe(false);
    expect(() => history.undo()).toThrow(new RangeError('The history has no move to undo.'));
    expect(restored).toEqual([]);
  });

  it('should_have_no_redo_capability_when_the_history_is_a_plain_move_history', () => {
    expect(new MoveHistory<string, string>().redoable()).toBeUndefined();
  });

  it('should_give_back_the_kept_state_when_a_command_is_undone', () => {
    const restored: string[] = [];
    const command = new MoveCommand(
      'the move',
      'the state before',
      'the state after',
      (memento) => {
        restored.push(memento);
      },
    );

    command.undo();

    expect(restored).toEqual(['the state before']);
  });

  // Issue #178: a command keeps the photo after its move too, so a redo gives it back.
  it('should_give_back_the_kept_state_after_the_move_when_a_command_is_redone', () => {
    const restored: string[] = [];
    const command = new MoveCommand(
      'the move',
      'the state before',
      'the state after',
      (memento) => {
        restored.push(memento);
      },
    );

    command.undo();
    command.redo();

    expect(restored).toEqual(['the state before', 'the state after']);
  });

  // Issue #178: a plain history forgets an undone command, so it keeps nothing to redo.
  it('should_forget_the_undone_command_when_the_history_is_a_plain_move_history', () => {
    const { history, record, restored } = newHistory();
    record('a', 'b');

    history.undo();

    expect(history.redoable()).toBeUndefined();
    expect(restored).toEqual(['b']);
    expect(history.canUndo()).toBe(true);
  });
});
