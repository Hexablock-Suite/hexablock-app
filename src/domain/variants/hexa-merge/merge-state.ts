import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';

// The state of one Hexa Merge game. It narrows `board` to the board of its topology.
// `targetReached` turns true when a merge makes the target tile, and it stays true:
// the target is an event, not the end of the game (A3).
// `merged` holds the tiles that the last move made, one per merge. The gain of the move
// is the sum of their values (§1.4), because a merge does not change the board total.
// The Merge scoring (issue #97) reads it.
// A cell is a value, so `clone()` shares the cell objects and copies the list.
export class MergeState<TCell, TCoord, TAxis extends string> implements BoardState<TCell, TCoord> {
  constructor(
    readonly board: Board<TCell, TCoord, TAxis>,
    readonly targetReached = false,
    readonly merged: readonly TCell[] = [],
    public score = 0,
  ) {}

  clone(): MergeState<TCell, TCoord, TAxis> {
    return new MergeState(this.board.clone(), this.targetReached, [...this.merged], this.score);
  }
}
