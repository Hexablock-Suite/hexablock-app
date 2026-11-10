import type { Outcome } from './outcome';
import { Resolution } from './resolution';
import type { ITimed } from './timed';

// Strategy (D1): the rules of one variant. `GameEngine` depends only on this interface.
// The state is an entity, so `apply()` changes it in place and returns the same object.
// No member names a cell or a coordinate, so it takes two type parameters (classes.md decision 16).
export interface IGameRules<TMove, TState> {
  isValid(state: TState, move: TMove): boolean;
  // The valid moves, one at a time, as a lazy sequence (classes.md decision 33).
  validMoves(state: TState): Iterable<TMove>;
  apply(state: TState, move: TMove): TState;
  resolve(state: TState): Resolution<TState>;
  evaluate(state: TState): Outcome;
  playTurn(state: TState, move: TMove): Resolution<TState>;
  // The timer of a timed game, or `undefined` (classes.md decision 27).
  timed(): ITimed | undefined;
}

// Template Method (D13, classes.md decision 21). `playTurn()` fixes the order of the turn.
// Each variant rules class extends this class and writes the abstract steps.
export abstract class BaseGameRules<TMove, TState> implements IGameRules<TMove, TState> {
  playTurn(state: TState, move: TMove): Resolution<TState> {
    if (!this.isValid(state, move)) return Resolution.rejected(state);
    const resolution = this.resolve(this.apply(state, move));
    // A move that `resolve()` rejects ends no game, so `evaluate()` does not run.
    if (!resolution.accepted) return resolution;
    return resolution.evaluated(this.evaluate(resolution.state));
  }

  // Plain rules have no timer. `TimedRulesDecorator` gives one around them.
  timed(): ITimed | undefined {
    return undefined;
  }

  // The end condition «no valid move» of Lines, Sort and Merge (classes.md decision 33).
  // It asks the lazy generator for the first move and stops there,
  // so it never builds the full list of moves.
  protected noValidMove(state: TState): boolean {
    for (const _move of this.validMoves(state)) return false;
    return true;
  }

  abstract isValid(state: TState, move: TMove): boolean;
  // Each variant writes it as a generator that walks `Board.line()`, `ring()`
  // and `neighborhood()` and yields one valid move at a time.
  abstract validMoves(state: TState): Iterable<TMove>;
  abstract apply(state: TState, move: TMove): TState;
  abstract resolve(state: TState): Resolution<TState>;
  abstract evaluate(state: TState): Outcome;
}
