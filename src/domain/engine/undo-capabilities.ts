// The undo capabilities of statement §3.2 (classes.md decisions 3, 4 and 27).
// The root asks them in `undo()`, `redo()`, `canUndo()` and `canRedo()`, and it hands out
// neither of them. So a use case asks the root and never reads a history (issue #234).
// They stay two interfaces, because a variant can undo and never redo (ISP).
export interface IUndoable {
  canUndo(): boolean;
  undo(): void;
}

export interface IRedoable {
  canRedo(): boolean;
  redo(): void;
}
