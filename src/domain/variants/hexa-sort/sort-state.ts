import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { IPieceSource } from '../../engine/piece-source';
import type { Piece } from '../../engine/piece';
import type { ColorStack } from './color-stack';
import type { GoalCount } from './goal-count';

// The move of Hexa Sort: place the offered stack on the cell `at` (statement §1.3).
export interface PlaceStack<TCoord> {
  readonly at: TCoord;
}

// The data that the Sort screen draws: the offered stack and the goal counts.
export interface SortView<TCoord> {
  readonly offered: Piece<ColorStack, TCoord> | undefined;
  readonly goalsDone: number;
  readonly goalsNeeded: GoalCount;
}

// The state of one Hexa Sort game (classes.md, Hexa Sort view).
// The piece source lives in the state (classes.md decision 31). The level chooses it:
// seeded random or a fixed list (A4). A Sort piece is one cell with a stack (decision 6).
// `offered` is the stack that the player places next. It is `undefined` when the source ends.
// `goalsDone` counts the cleared stacks. `goalsNeeded` is the goal of the level, a `GoalCount`.
// `clearedTiles` holds the tile count of each stack that the last turn cleared,
// so the Sort scoring (issue #98) can read it. `placedAt` is the cell of the last move.
export class SortState<TCoord> implements BoardState<ColorStack, TCoord> {
  private constructor(
    readonly board: Board<ColorStack, TCoord, string>,
    readonly source: IPieceSource<Piece<ColorStack, TCoord>>,
    readonly goalsNeeded: GoalCount,
    public offered: Piece<ColorStack, TCoord> | undefined,
    public goalsDone: number,
    public clearedTiles: number[],
    public placedAt: TCoord | undefined,
    public score: number,
  ) {}

  // A new game: no goal done, no score, and the first stack of the source on offer.
  static start<TCoord>(values: {
    board: Board<ColorStack, TCoord, string>;
    source: IPieceSource<Piece<ColorStack, TCoord>>;
    goalsNeeded: GoalCount;
  }): SortState<TCoord> {
    const state = new SortState(
      values.board,
      values.source,
      values.goalsNeeded,
      undefined,
      0,
      [],
      undefined,
      0,
    );
    state.offerNext();
    return state;
  }

  // Draws the next stack from the source, or offers none when the source ends.
  offerNext(): void {
    this.offered = this.source.hasNext() ? this.source.next() : undefined;
  }

  // A piece and a goal count never change, so the view shares them.
  // `offered` and `goalsDone` are public and mutable, so the view keeps their values of now.
  view(): SortView<TCoord> {
    return Object.freeze({
      offered: this.offered,
      goalsDone: this.goalsDone,
      goalsNeeded: this.goalsNeeded,
    });
  }

  clone(): SortState<TCoord> {
    return new SortState(
      this.board.clone(),
      this.source.clone(),
      this.goalsNeeded,
      this.offered,
      this.goalsDone,
      [...this.clearedTiles],
      this.placedAt,
      this.score,
    );
  }
}
