import type { MoveCommand } from './move-command';

// The undo capabilities of statement §3.2 (classes.md decisions 3, 4 and 27).
// The root asks them in `undo()`, `redo()`, `canUndo()` and `canRedo()`, and it hands out
// neither of them. So a use case asks the root and never reads a history (issue #234).
// They stay two interfaces, because a variant can undo and never redo (ISP).

// The history that the root depends on (DIP, issue #414). It declares the five members
// that the root calls: `record()` keeps the command of a saved turn, `clear()` forgets
// every command, `canUndo()` and `undo()` take the last move back, and `redoable()` gives
// the redo of a history that can redo. `MoveHistory` implements it.
// `TMemento` is the type of the photo inside each command: the root binds it to `SnapshotOf<TState>`.
export interface IUndoable<TMove, TMemento> {
  record(command: MoveCommand<TMove, TMemento>): void;
  clear(): void;
  canUndo(): boolean;
  undo(): void;
  redoable(): IRedoable | undefined;
}

export interface IRedoable {
  canRedo(): boolean;
  redo(): void;
}
