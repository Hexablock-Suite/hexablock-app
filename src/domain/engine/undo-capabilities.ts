// The undo capabilities of statement §3.2 (classes.md decisions 3, 4 and 27).
// `GameEngine.undoable()` and `redoable()` return them, so a use case never reads a history class.
// They stay two interfaces, because a variant can undo and never redo (ISP).
export interface IUndoable {
  canUndo(): boolean;
  undo(): void;
}

export interface IRedoable {
  canRedo(): boolean;
  redo(): void;
}
