// Command (statement §3.3) with its Memento (classes.md decision 34).
// `before` and `after` are Mementos: the photos of the state before and after the move
// (`BoardState.snapshot()`). The photos are immutable, so the command keeps them as they are.
// Only this class reads them.
// `restore` is the receiver: the function through which `GameEngine` takes a photo back.
// So `undo()` and `redo()` return nothing, and the engine needs no public member that replaces
// its state. `undo()` gives back the photo before the move, and `redo()` gives back the photo
// after it (issue #178). So an undo and then a redo give back the same board.
// `TMemento` is the type of the photo. The engine binds it to `SnapshotOf<TState>`.
export class MoveCommand<TMove, TMemento> {
  constructor(
    private readonly move: TMove,
    private readonly before: TMemento,
    private readonly after: TMemento,
    private readonly restore: (memento: TMemento) => void,
  ) {}

  undo(): void {
    this.restore(this.before);
  }

  redo(): void {
    this.restore(this.after);
  }
}
