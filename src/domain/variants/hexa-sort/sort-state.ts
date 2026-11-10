import type { Board } from '../../engine/board';
import { checkOwnSnapshot, type BoardSnapshot, type BoardState } from '../../engine/board-state';
import type { Cloneable } from '../../engine/cloneable';
import type { GameStateId } from '../../engine/game-state-id';
import type { MatchId } from '../../engine/match-id';
import type { IPieceSource } from '../../engine/piece-source';
import type { Piece } from '../../engine/piece';
import { ColorStack } from './color-stack';
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

// The photo of a Sort state (classes.md decision 34): the board, the score, the offered stack,
// the goals, the facts of the last turn and a copy of the piece source at its position.
// The source shows only `clone()`, so a reader cannot draw from the photo.
// `view()` gives the offered stack and the goal counts for the screen.
export interface SortSnapshot<TCoord> extends BoardSnapshot<ColorStack, TCoord> {
  readonly offered: Piece<ColorStack, TCoord> | undefined;
  readonly goalsDone: number;
  readonly goalsNeeded: GoalCount;
  readonly clearedTiles: readonly number[];
  readonly placedAt: TCoord | undefined;
  readonly source: Cloneable<IPieceSource<Piece<ColorStack, TCoord>>>;
  view(): SortView<TCoord>;
}

// The state of one Hexa Sort game (classes.md, Hexa Sort view).
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// It changes only through `placeOfferedStack()`, `moveRun()`, `clearStack()`,
// `offerNext()`, `addPoints()` and `restore()`. The rules decide when to call them.
// A refused input throws a RangeError and leaves the whole state as it was.
// The scoring, the rules and the use cases read the photo of `snapshot()`, never a field.
// The piece source lives in the state (classes.md decision 31). The level chooses it:
// seeded random or a fixed list (A4). A Sort piece is one cell with a stack (decision 6).
// `offered` is the stack that the player places next. It is `undefined` when the source ends.
// `goalsDone` counts the cleared stacks. `goalsNeeded` is the goal of the level, a `GoalCount`.
// `clearedTiles` holds the tile count of each stack that the last turn cleared,
// so the Sort scoring (issue #98) can read it. `placedAt` is the cell of the last move.
export class SortState<TCoord> implements BoardState<ColorStack, TCoord> {
  private constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: Board<ColorStack, TCoord, string>,
    private source: IPieceSource<Piece<ColorStack, TCoord>>,
    private readonly goalsNeeded: GoalCount,
    private offered: Piece<ColorStack, TCoord> | undefined,
    private goalsDone: number,
    private clearedTiles: number[],
    private placedAt: TCoord | undefined,
    private score: number,
  ) {}

  // A new game: no goal done, no score, and the first stack of the source on offer.
  static start<TCoord>(values: {
    stateId: GameStateId;
    matchId: MatchId;
    board: Board<ColorStack, TCoord, string>;
    source: IPieceSource<Piece<ColorStack, TCoord>>;
    goalsNeeded: GoalCount;
  }): SortState<TCoord> {
    const state = new SortState(
      values.stateId,
      values.matchId,
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

  // True when a stack is on offer and the cell lies inside the board with no stack,
  // or with an empty stack.
  canPlace(at: TCoord): boolean {
    return this.offered !== undefined && this.isFree(at);
  }

  // Puts the offered stack on the cell, starts the facts of a new turn
  // and offers the next stack. No stack on offer, a cell outside the board
  // or a cell with a stack throws a RangeError.
  placeOfferedStack(at: TCoord): void {
    if (this.offered === undefined) throw new RangeError('No stack is on offer.');
    this.checkInside(at);
    if (!this.isFree(at)) {
      throw new RangeError(`The cell ${this.board.topology.key(at)} already holds a stack.`);
    }
    this.board.occupy(at, this.offered.content);
    this.placedAt = at;
    this.clearedTiles = [];
    this.offerNext();
  }

  // Moves the top run of the stack at `from` onto the stack at `to`.
  // A cell `to` with no stack takes the run as a new stack.
  // A cell `from` with no tile, the same cell twice, or a cell `to` outside the board
  // throws a RangeError.
  moveRun(from: TCoord, to: TCoord): void {
    const giver = this.board.get(from);
    if (giver === undefined || giver.isEmpty()) {
      throw new RangeError(`The cell ${this.board.topology.key(from)} has no stack to move.`);
    }
    this.checkInside(to);
    if (this.board.topology.key(from) === this.board.topology.key(to)) {
      throw new RangeError(`A run cannot move to its own cell ${this.board.topology.key(to)}.`);
    }
    const receiver = this.board.get(to) ?? ColorStack.empty();
    this.board.occupy(from, giver.withoutTopRun());
    this.board.occupy(to, receiver.withOnTop(giver.topRun()));
  }

  // Removes the whole stack at `at` and counts one goal. The cell keeps an empty stack,
  // and `clearedTiles` keeps the tile count of the stack for the scoring (#98).
  // A cell with no tile throws a RangeError.
  clearStack(at: TCoord): void {
    const stack = this.board.get(at);
    if (stack === undefined || stack.isEmpty()) {
      throw new RangeError(`The cell ${this.board.topology.key(at)} has no stack to clear.`);
    }
    this.board.occupy(at, ColorStack.empty());
    this.goalsDone += 1;
    this.clearedTiles.push(stack.tileCount());
  }

  addPoints(points: number): void {
    if (!Number.isFinite(points)) {
      throw new RangeError(`The points of a turn must be a finite number, not ${points}.`);
    }
    this.score += points;
  }

  // The photo of the state now. A piece, a goal count and a coordinate never change,
  // so the photo shares them. It holds a frozen list and copies of the board and the source.
  snapshot(): SortSnapshot<TCoord> {
    const view = Object.freeze({
      offered: this.offered,
      goalsDone: this.goalsDone,
      goalsNeeded: this.goalsNeeded,
    });
    return Object.freeze({
      stateId: this.stateId,
      matchId: this.matchId,
      board: this.board.clone(),
      score: this.score,
      offered: this.offered,
      goalsDone: this.goalsDone,
      goalsNeeded: this.goalsNeeded,
      clearedTiles: Object.freeze([...this.clearedTiles]),
      placedAt: this.placedAt,
      source: this.source.clone(),
      view: () => view,
    });
  }

  // Takes back a photo of this state, in place. The goal of the level never changes,
  // so the state keeps its own goal. A photo of another state, of another board,
  // or with a score that is not finite changes nothing.
  restore(snapshot: SortSnapshot<TCoord>): void {
    checkOwnSnapshot(this.stateId, this.board, snapshot);
    if (!Number.isFinite(snapshot.score)) {
      throw new RangeError(`The score of a state must be a finite number, not ${snapshot.score}.`);
    }
    this.board.restore(snapshot.board);
    this.source = snapshot.source.clone();
    this.offered = snapshot.offered;
    this.goalsDone = snapshot.goalsDone;
    this.clearedTiles = [...snapshot.clearedTiles];
    this.placedAt = snapshot.placedAt;
    this.score = snapshot.score;
  }

  // True when this state is the state of the match `match`.
  belongsTo(match: MatchId): boolean {
    return this.matchId.equals(match);
  }

  // Two states with one `GameStateId` are the same state.
  // Their matches, their boards, their scores and their other values do not count.
  equals(other: BoardState<ColorStack, TCoord>): boolean {
    return other instanceof SortState && this.stateId.equals(other.stateId);
  }

  // A cell inside the board with no stack, or with an empty stack, is free.
  private isFree(at: TCoord): boolean {
    return this.board.contains(at) && (this.board.get(at)?.isEmpty() ?? true);
  }

  private checkInside(at: TCoord): void {
    if (!this.board.contains(at)) {
      throw new RangeError(`The coordinate ${this.board.topology.key(at)} is outside the board.`);
    }
  }

  clone(): SortState<TCoord> {
    return new SortState(
      this.stateId,
      this.matchId,
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
