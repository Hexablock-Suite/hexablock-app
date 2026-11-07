import type { Board } from '../../engine/board';
import type { Outcome } from '../../engine/outcome';
import { Resolution } from '../../engine/resolution';
import { BaseGameRules } from '../../engine/rules';
import { ColorStack } from './color-stack';
import type { PlaceStack, SortState } from './sort-state';

// A top run of this many tiles of one color clears its stack (statement §1.3).
// The accepted rule of issue #56: a top run of 10 or more removes the whole stack,
// tiles of other colors below included, and counts one goal.
export const GOAL_RUN = 10;

// The rules of Hexa Sort (statement §1.3). The player places the offered stack on an
// empty cell. Then the top tiles of neighbor stacks with the same top color move,
// in cascade, to the stack with most of that color.
// The rules ask the topology for the neighbors, so they run on any geometry (D4).
export class SortRules<TCoord> extends BaseGameRules<PlaceStack<TCoord>, SortState<TCoord>> {
  isValid(state: SortState<TCoord>, move: PlaceStack<TCoord>): boolean {
    return state.offered !== undefined && isEmptyCell(state.board, move.at);
  }

  *validMoves(state: SortState<TCoord>): Iterable<PlaceStack<TCoord>> {
    if (state.offered === undefined) return;
    for (const at of state.board.shape.cells) {
      if (isEmptyCell(state.board, at)) yield { at };
    }
  }

  apply(state: SortState<TCoord>, move: PlaceStack<TCoord>): SortState<TCoord> {
    if (state.offered === undefined) throw new RangeError('No stack is on offer.');
    state.board.set(move.at, state.offered.content);
    state.placedAt = move.at;
    state.clearedTiles = [];
    state.offerNext();
    return state;
  }

  // The cascade starts at the placed stack. Each transfer changes the stacks it touches,
  // so the cascade checks them again. Each transfer joins two runs into one,
  // so the number of runs on the board falls and the cascade ends.
  resolve(state: SortState<TCoord>): Resolution<SortState<TCoord>> {
    const pending: TCoord[] = state.placedAt === undefined ? [] : [state.placedAt];
    for (let at = pending.shift(); at !== undefined; at = pending.shift()) {
      clearIfGoal<TCoord>(state, at);
      pending.push(...transfer<TCoord>(state, at));
    }
    return Resolution.resolved(state);
  }

  // The goals reached win. A board with no empty cell, or no stack left to place, loses.
  evaluate(state: SortState<TCoord>): Outcome {
    if (state.goalsDone >= state.goalsNeeded) return 'victory';
    return this.noValidMove(state) ? 'game-over' : 'playing';
  }
}

function isEmptyCell<TCoord>(board: Board<ColorStack, TCoord, string>, at: TCoord): boolean {
  return board.contains(at) && (board.get(at)?.isEmpty() ?? true);
}

// Moves top runs between the stack at `at` and its neighbors with the same top color.
// It returns the cells that changed, or none when no neighbor shares the color.
function transfer<TCoord>(state: SortState<TCoord>, at: TCoord): TCoord[] {
  const board = state.board;
  const color = board.get(at)?.top();
  if (color === undefined) return [];
  const matches = [...board.neighborhood(at)].filter((n) => board.get(n)?.top() === color);
  if (matches.length === 0) return [];
  const target = targetOf(board, at, matches);
  // When `at` is the target, every matching neighbor gives its run to it.
  // Otherwise only `at` gives its run, because the other neighbors can lie away from the target.
  const key = (c: TCoord) => board.topology.key(c);
  const givers = key(target) === key(at) ? matches : [at];
  let receiver = board.get(target) ?? ColorStack.empty();
  for (const giver of givers) {
    const from = board.get(giver) ?? ColorStack.empty();
    receiver = receiver.withOnTop(from.topRun());
    board.set(giver, from.withoutTopRun());
  }
  board.set(target, receiver);
  clearIfGoal(state, target);
  return [...givers, target];
}

// The stack with the longest top run wins. The accepted rule of issue #56: the amount
// compared is the size of the top run, and a tie goes to the stack whose coordinate key
// comes first. The keys compare by plain string order (code units, `<`), not by
// `localeCompare`, so the order is the same on every device and locale.
// The key order does not depend on when a cell was filled or emptied (gap G108.3).
function targetOf<TCoord>(
  board: Board<ColorStack, TCoord, string>,
  first: TCoord,
  others: readonly TCoord[],
): TCoord {
  const run = (c: TCoord) => board.get(c)?.topRun().length ?? 0;
  const key = (c: TCoord) => board.topology.key(c);
  return others.reduce((best, c) => {
    const longer = run(c) - run(best);
    return longer > 0 || (longer === 0 && key(c) < key(best)) ? c : best;
  }, first);
}

// The accepted rule of issue #56: a top run of `GOAL_RUN` or more removes
// the whole stack and counts one goal. The board cannot remove a cell,
// so the cell gets an empty stack. `clearedTiles` keeps the size for the scoring (#98).
function clearIfGoal<TCoord>(state: SortState<TCoord>, at: TCoord): void {
  const cell = state.board.get(at);
  if (cell === undefined || cell.topRun().length < GOAL_RUN) return;
  state.board.set(at, ColorStack.empty());
  state.goalsDone += 1;
  state.clearedTiles.push(cell.size);
}
