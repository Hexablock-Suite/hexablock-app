// Command (statement §3.3) with its Memento (classes.md decision 34).
// `before` is the Memento: a clone of the state before the move. Only this class reads it.
// `restore` is the receiver: the function through which `GameEngine` takes the state back.
// So `undo()` returns nothing, and the engine needs no public member that replaces its state.
export class MoveCommand<TMove, TState> {
  constructor(
    readonly move: TMove,
    private readonly before: TState,
    private readonly restore: (memento: TState) => void,
  ) {}

  undo(): void {
    this.restore(this.before);
  }
}
