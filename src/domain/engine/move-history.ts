import type { MoveCommand } from './move-command';
import type { IRedoable, IUndoable } from './undo-capabilities';
import type { UndoLimit } from './undo-limit';

// Command invoker and Memento caretaker (classes.md decisions 3 and 34).
// The history keeps the commands of one game and never reads the photo inside them.
// `TMemento` is the type of that photo: the engine binds it to `SnapshotOf<TState>`.
// Without a `limit` the history keeps every command. With a limit it keeps the newest ones.
// A limit is an `UndoLimit`, which checks its count in `UndoLimit.of()` (issue #243).
// A variant with no undo has no history at all.
export class MoveHistory<TMove, TMemento> implements IUndoable {
  private done: MoveCommand<TMove, TMemento>[] = [];

  constructor(private readonly limit?: UndoLimit) {}

  // The newest command goes last. A full history drops its oldest command.
  record(command: MoveCommand<TMove, TMemento>): void {
    this.done.push(command);
    if (this.limit !== undefined) this.done = this.limit.newestOf(this.done);
  }

  canUndo(): boolean {
    return this.done.length > 0;
  }

  // The command leaves the history only after the engine takes the state back.
  // So a refused undo keeps the command, and the player can try again.
  // Then the history gives the undone command to `keepUndone()`.
  undo(): void {
    const last = this.done.at(-1);
    if (last === undefined) throw new RangeError('The history has no move to undo.');
    last.undo();
    this.done.pop();
    this.keepUndone(last);
  }

  // A new game and a finished game have no move to undo.
  clear(): void {
    this.done.length = 0;
  }

  // A plain history cannot redo. A history that can redo overrides this method and returns itself,
  // so the engine reads the capability with no check of the history class (classes.md decision 27).
  redoable(): IRedoable | undefined {
    return undefined;
  }

  // The hook of an undone command (issue #178). A plain history forgets the command.
  // `RedoableHistory` keeps it, so a redo can play it again.
  protected keepUndone(_command: MoveCommand<TMove, TMemento>): void {
    return;
  }
}
