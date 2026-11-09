import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { IPieceSource } from '../../engine/piece-source';
import type { NewTile } from './new-tile';

// The data that the Merge screen draws: whether the target tile exists.
export interface MergeView {
  readonly targetReached: boolean;
}

// The state of one Hexa Merge game. It narrows `board` to the board of its topology.
// `tiles` is the source of the new tiles. It lives in the state (classes.md decision 31),
// so `clone()` clones it, and the rollback of `GameEngine.play()` covers each draw.
// `targetReached` turns true when a merge makes the target tile, and it stays true:
// the target is an event, not the end of the game (A3).
// `merged` holds the tiles that the last move made, one per merge. The gain of the move
// is the sum of their values (§1.4), because a merge does not change the board total.
// The Merge scoring (issue #97) reads it.
// A cell is a value, so `clone()` shares the cell objects and copies the list.
export class MergeState<TCell, TCoord, TAxis extends string> implements BoardState<TCell, TCoord> {
  constructor(
    readonly board: Board<TCell, TCoord, TAxis>,
    readonly tiles: IPieceSource<NewTile<TCell>>,
    readonly targetReached = false,
    readonly merged: readonly TCell[] = [],
    public score = 0,
  ) {}

  view(): MergeView {
    return Object.freeze({ targetReached: this.targetReached });
  }

  clone(): MergeState<TCell, TCoord, TAxis> {
    return new MergeState(
      this.board.clone(),
      this.tiles.clone(),
      this.targetReached,
      [...this.merged],
      this.score,
    );
  }
}
