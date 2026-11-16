import type { MoveCommand } from './move-command';
import { MoveHistory } from './move-history';
import type { IRedoable } from './undo-capabilities';

// The history of a variant that undoes and redoes (APP-FR-08, classes.md decisions 3 and 4,
// issue #178). It is the Command invoker of `MoveHistory` with redo: it keeps each undone
// command in `undone`, newest last, and `redo()` plays the newest one again.
// `FitFactory` gives it no `UndoLimit`, so Hexa Fit undoes and redoes with no limit.
// A new move, a new game and a finished game forget the undone commands,
// because a redo after them would give back a board of another line of play.
// It answers `redoable()` with itself, so the root reads the redo with no check of the class.
export class RedoableHistory<TMove, TMemento>
  extends MoveHistory<TMove, TMemento>
  implements IRedoable
{
  private readonly undone: MoveCommand<TMove, TMemento>[] = [];

  // A new move ends the line of play that the undone commands belong to.
  override record(command: MoveCommand<TMove, TMemento>): void {
    super.record(command);
    this.undone.length = 0;
  }

  override clear(): void {
    super.clear();
    this.undone.length = 0;
  }

  override redoable(): IRedoable {
    return this;
  }

  canRedo(): boolean {
    return this.undone.length > 0;
  }

  // The command leaves `undone` only after the engine takes the state back.
  // So a refused redo keeps the command, and the player can try again.
  // The redone command goes back to the done commands, so an undo can take it back again.
  redo(): void {
    const last = this.undone.at(-1);
    if (last === undefined) throw new RangeError('The history has no move to redo.');
    last.redo();
    this.undone.pop();
    super.record(last);
  }

  protected override keepUndone(command: MoveCommand<TMove, TMemento>): void {
    this.undone.push(command);
  }
}
