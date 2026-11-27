import type { Outcome } from './outcome';
import { Resolution } from './resolution';

// Strategy (D1): the rules of one variant. `GameEngine` depends only on this interface.
// It declares only the members that a caller needs (ISP, classes.md decision 21, issue #413).
// `GameEngine` calls `playTurn()`. `validMoves()` stays, because the rules define
// the valid moves (statement §3.1, classes.md decision 33).
// `playTurn()` returns a `Resolution`, which holds no state: the caller reads
// the state that it gave. The rules read a state through its photo (`snapshot()`) and through
// its queries with business names, and they change it only through its business methods.
// No member names a cell or a coordinate, so it takes two type parameters (classes.md decision 16).
export interface IGameRules<TMove, TState> {
  // The valid moves, one at a time, as a lazy sequence (classes.md decision 33).
  validMoves(state: TState): Iterable<TMove>;
  playTurn(state: TState, move: TMove): Resolution;
}

// Template Method (D13, classes.md decision 21). `playTurn()` fixes the order of the turn.
// Each variant rules class extends this class and writes the abstract steps.
// The steps are protected, so only the template method calls them (issue #413).
// The state is an entity, so `apply()` changes it in place and returns the same object.
export abstract class BaseGameRules<TMove, TState> implements IGameRules<TMove, TState> {
  playTurn(state: TState, move: TMove): Resolution {
    if (!this.isValid(state, move)) return Resolution.rejected();
    const next = this.apply(state, move);
    const resolution = this.resolve(next);
    // A move that `resolve()` rejects ends no game, so `evaluate()` does not run.
    if (!resolution.wasAccepted()) return resolution;
    return resolution.evaluated(this.evaluate(next));
  }

  // The end condition «no valid move» of Lines, Sort and Merge (classes.md decision 33).
  // It asks the lazy generator for the first move and stops there,
  // so it never builds the full list of moves.
  protected noValidMove(state: TState): boolean {
    for (const _move of this.validMoves(state)) return false;
    return true;
  }

  // Each variant writes it as a generator that walks `Board.line()`, `ring()`
  // and `neighborhood()` and yields one valid move at a time.
  abstract validMoves(state: TState): Iterable<TMove>;
  protected abstract isValid(state: TState, move: TMove): boolean;
  protected abstract apply(state: TState, move: TMove): TState;
  protected abstract resolve(state: TState): Resolution;
  protected abstract evaluate(state: TState): Outcome;
}
