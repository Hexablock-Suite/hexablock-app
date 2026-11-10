// Command (statement §3.3) with its Memento (classes.md decision 34).
// `before` is the Memento: the photo of the state before the move (`BoardState.snapshot()`).
// The photo is immutable, so the command keeps it as it is. Only this class reads it.
// `restore` is the receiver: the function through which `GameEngine` takes the photo back.
// So `undo()` returns nothing, and the engine needs no public member that replaces its state.
// `TMemento` is the type of the photo. The engine binds it to `SnapshotOf<TState>`.
export class MoveCommand<TMove, TMemento> {
  constructor(
    private readonly move: TMove,
    private readonly before: TMemento,
    private readonly restore: (memento: TMemento) => void,
  ) {}

  undo(): void {
    this.restore(this.before);
  }
}
