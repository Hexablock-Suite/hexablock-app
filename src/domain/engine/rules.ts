import type { Outcome } from './outcome';
import { Resolution } from './resolution';

// Strategy (D1): the rules of one variant. `GameEngine` depends only on this interface.
// No member names a cell or a coordinate, so it takes two type parameters (classes.md decision 16).
export interface IGameRules<TMove, TState> {
  isValid(state: TState, move: TMove): boolean;
  // The valid moves, one at a time, as a lazy sequence (classes.md decision 33).
  validMoves(state: TState): Iterable<TMove>;
  apply(state: TState, move: TMove): TState;
  resolve(state: TState): Resolution<TState>;
  evaluate(state: TState): Outcome;
  playTurn(state: TState, move: TMove): Resolution<TState>;
}

// Template Method (D13, classes.md decision 21). `playTurn()` fixes the order of the turn.
// Each variant rules class extends this class and writes the abstract steps.
export abstract class BaseGameRules<TMove, TState> implements IGameRules<TMove, TState> {
  playTurn(state: TState, move: TMove): Resolution<TState> {
    if (!this.isValid(state, move)) return Resolution.rejected(state);
    const resolution = this.resolve(this.apply(state, move));
    return resolution.evaluated(this.evaluate(resolution.state));
  }

  abstract isValid(state: TState, move: TMove): boolean;
  abstract validMoves(state: TState): Iterable<TMove>;
  abstract apply(state: TState, move: TMove): TState;
  abstract resolve(state: TState): Resolution<TState>;
  abstract evaluate(state: TState): Outcome;
}
