import type { MoveCommand } from './move-command';
import type { IRedoable, IUndoable } from './undo-capabilities';

// Command invoker and Memento caretaker (classes.md decisions 3 and 34).
// The history keeps the commands of one game and never reads the photo inside them.
// `TMemento` is the type of that photo: the engine binds it to `SnapshotOf<TState>`.
// Without a `limit` the history keeps every command. With a limit it keeps the newest ones.
// A limit is a whole number of 1 or more. A variant with no undo has no history at all.
export class MoveHistory<TMove, TMemento> implements IUndoable {
  private readonly done: MoveCommand<TMove, TMemento>[] = [];

  constructor(private readonly limit?: number) {
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
      throw new RangeError(`A history limit needs a whole number of 1 or more, not ${limit}.`);
    }
  }

  // The newest command goes last. A full history drops its oldest command.
  record(command: MoveCommand<TMove, TMemento>): void {
    this.done.push(command);
    if (this.limit !== undefined && this.done.length > this.limit) this.done.shift();
  }

  canUndo(): boolean {
    return this.done.length > 0;
  }

  // The command leaves the history only after the engine takes the state back.
  // So a refused undo keeps the command, and the player can try again.
  undo(): void {
    const last = this.done.at(-1);
    if (last === undefined) throw new RangeError('The history has no move to undo.');
    last.undo();
    this.done.pop();
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
}
