import type { Board, ReadonlyBoard } from '../../engine/board';
import { BoardSnapshot, checkOwnSnapshot, type BoardState } from '../../engine/board-state';
import type { GameStateId } from '../../engine/game-state-id';
import type { MatchId } from '../../engine/match-id';
import { Score } from '../../engine/score';
import type { IPieceSource } from '../../engine/piece-source';
import type { Piece } from '../../engine/piece';
import { ClearedStacks } from './cleared-stacks';
import { ColorStack } from './color-stack';
import type { GoalCount } from './goal-count';
import type { TileCount } from './tile-count';

// The receiver of the data of a `SortView`. An adapter of the edge implements it,
// for example the state mapper of the Sort screen. No code of `src/domain/` or
// `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface SortViewReceiver<TCoord> {
  receive(
    offered: Piece<ColorStack, TCoord> | undefined,
    goalsDone: ClearedStacks,
    goalsNeeded: GoalCount,
  ): void;
}

// The data that the Sort screen draws: the offered stack and the goal counts.
// Every field is private (issue #245). A piece and a count never change, so the view shares them,
// and `deliverTo()` gives them to an adapter of the edge.
export class SortView<TCoord> {
  constructor(
    private readonly offered: Piece<ColorStack, TCoord> | undefined,
    private readonly goalsDone: ClearedStacks,
    private readonly goalsNeeded: GoalCount,
  ) {
    Object.freeze(this);
  }

  // Gives the offered stack and the two goal counts to `receiver`. It returns nothing.
  deliverTo(receiver: SortViewReceiver<TCoord>): void {
    receiver.receive(this.offered, this.goalsDone, this.goalsNeeded);
  }
}

// The photo of a Sort state (classes.md decision 34): the board, the score, the offered stack,
// the goals, the facts of the last turn and the piece source at its position.
// The source is a value (classes.md decision 51), so the photo shares it with the state,
// and a reader that draws from it changes nothing.
// `view()` gives the offered stack and the goal counts for the screen.
// Every field is private (issue #245). The rules ask `offeredStack()`, `lastPlacedAt()`,
// `goalsReached()` and `goal()`, the scoring asks `clearedStackHeights()`, and
// `SortState.restore()` asks the facts of the state. The photo keeps a frozen list
// of the cleared heights, and it is frozen itself.
export class SortSnapshot<TCoord> extends BoardSnapshot<ColorStack, TCoord> {
  private readonly clearedTiles: readonly TileCount[];

  constructor(
    stateId: GameStateId,
    matchId: MatchId,
    board: ReadonlyBoard<ColorStack, TCoord>,
    score: Score,
    private readonly offered: Piece<ColorStack, TCoord> | undefined,
    private readonly goalsDone: ClearedStacks,
    private readonly goalsNeeded: GoalCount,
    clearedTiles: readonly TileCount[],
    private readonly placedAt: TCoord | undefined,
    private readonly source: IPieceSource<Piece<ColorStack, TCoord>>,
    private readonly shown: SortView<TCoord>,
  ) {
    super(stateId, matchId, board, score);
    this.clearedTiles = Object.freeze([...clearedTiles]);
    Object.freeze(this);
  }

  // The stack that the player places next, or `undefined` when the source has ended.
  offeredStack(): Piece<ColorStack, TCoord> | undefined {
    return this.offered;
  }

  // The count of the stacks that the game has cleared.
  goalsReached(): ClearedStacks {
    return this.goalsDone;
  }

  // The goal of the level: the count of stacks to clear.
  goal(): GoalCount {
    return this.goalsNeeded;
  }

  // The height of each stack that the last turn cleared, in the order of the clears.
  clearedStackHeights(): readonly TileCount[] {
    return this.clearedTiles;
  }

  // The cell of the last placed stack, or `undefined` before the first move.
  lastPlacedAt(): TCoord | undefined {
    return this.placedAt;
  }

  // The piece source at its position. Only `SortState.restore()` needs it.
  pieceSource(): IPieceSource<Piece<ColorStack, TCoord>> {
    return this.source;
  }

  view(): SortView<TCoord> {
    return this.shown;
  }
}

// The state of one Hexa Sort game (classes.md, Hexa Sort view).
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// It changes only through `placeOfferedStack()`, `moveRun()`, `clearStack()`,
// `offerNext()`, `addPoints()` and `restore()`. The rules decide when to call them.
// A refused input throws a RangeError and leaves the whole state as it was.
// The scoring, the rules and the use cases ask the photo of `snapshot()`, never a field.
// The piece source lives in the state (classes.md decision 31). The level chooses it:
// seeded random or a fixed list (A4). A Sort piece is one cell with a stack (decision 6).
// `offered` is the stack that the player places next. It is `undefined` when the source ends.
// `goalsDone` counts the cleared stacks, as a `ClearedStacks` (classes.md decision 42).
// `goalsNeeded` is the goal of the level, a `GoalCount`.
// `clearedTiles` holds the `TileCount` of each stack that the last turn cleared (issue #232),
// so the Sort scoring (issue #98) can read it. `placedAt` is the cell of the last move.
export class SortState<TCoord> implements BoardState<ColorStack, TCoord> {
  private constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: Board<ColorStack, TCoord>,
    private source: IPieceSource<Piece<ColorStack, TCoord>>,
    private readonly goalsNeeded: GoalCount,
    private offered: Piece<ColorStack, TCoord> | undefined,
    private goalsDone: ClearedStacks,
    private clearedTiles: TileCount[],
    private placedAt: TCoord | undefined,
    private score: Score,
  ) {}

  // A new game: no goal done, no score, and the first stack of the source on offer.
  static start<TCoord>(values: {
    stateId: GameStateId;
    matchId: MatchId;
    board: Board<ColorStack, TCoord>;
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
      ClearedStacks.of(0),
      [],
      undefined,
      Score.of(0),
    );
    state.offerNext();
    return state;
  }

  // Draws the next stack from the source, or offers none when the source ends.
  // A draw gives the next source, and the state keeps it in place of its source.
  offerNext(): void {
    if (!this.source.hasNext()) {
      this.offered = undefined;
      return;
    }
    const [piece, rest] = this.source.take();
    this.offered = piece;
    this.source = rest;
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
      throw new RangeError(`The cell ${this.board.key(at)} already holds a stack.`);
    }
    this.board.occupy(at, this.offered.occupant());
    this.placedAt = at;
    this.clearedTiles = [];
    this.offerNext();
  }

  // Moves the top run of the stack at `from` onto the stack at `to`.
  // A cell `to` with no stack takes the run as a new stack.
  // A cell `from` with no tile, the same cell twice, or a cell `to` outside the board
  // throws a RangeError.
  moveRun(from: TCoord, to: TCoord): void {
    const giver = this.board.occupantAt(from);
    if (giver === undefined || giver.isEmpty()) {
      throw new RangeError(`The cell ${this.board.key(from)} has no stack to move.`);
    }
    this.checkInside(to);
    if (this.board.key(from) === this.board.key(to)) {
      throw new RangeError(`A run cannot move to its own cell ${this.board.key(to)}.`);
    }
    const receiver = this.board.occupantAt(to) ?? ColorStack.empty();
    this.board.occupy(from, giver.withoutTopRun());
    this.board.occupy(to, receiver.withOnTop(giver.topRun()));
  }

  // Removes the whole stack at `at` and counts one goal. The cell keeps an empty stack,
  // and `clearedTiles` keeps the tile count of the stack for the scoring (#98).
  // A cell with no tile throws a RangeError.
  clearStack(at: TCoord): void {
    const stack = this.board.occupantAt(at);
    if (stack === undefined || stack.isEmpty()) {
      throw new RangeError(`The cell ${this.board.key(at)} has no stack to clear.`);
    }
    this.board.occupy(at, ColorStack.empty());
    this.goalsDone = this.goalsDone.plusOne();
    this.clearedTiles.push(stack.tileCount());
  }

  // The engine adds the points of a turn in place. `Score.add()` refuses a total
  // above the largest safe integer, and the score stays as it was.
  addPoints(points: Score): void {
    this.score = this.score.add(points);
  }

  // The photo of the state now. A piece, a goal count and a coordinate never change,
  // and the source is a value, so the photo shares them.
  // It holds a frozen list and a copy of the board.
  snapshot(): SortSnapshot<TCoord> {
    return new SortSnapshot(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.score,
      this.offered,
      this.goalsDone,
      this.goalsNeeded,
      this.clearedTiles,
      this.placedAt,
      this.source,
      new SortView(this.offered, this.goalsDone, this.goalsNeeded),
    );
  }

  // Takes back a photo of this state, in place. The goal of the level never changes,
  // so the state keeps its own goal. A photo of another state or of another board
  // changes nothing.
  restore(snapshot: SortSnapshot<TCoord>): void {
    checkOwnSnapshot(this.stateId, this.board, snapshot);
    this.board.restore(snapshot.boardCopy());
    this.source = snapshot.pieceSource();
    this.offered = snapshot.offeredStack();
    this.goalsDone = snapshot.goalsReached();
    this.clearedTiles = [...snapshot.clearedStackHeights()];
    this.placedAt = snapshot.lastPlacedAt();
    this.score = snapshot.scoreSoFar();
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
    return this.board.contains(at) && (this.board.occupantAt(at)?.isEmpty() ?? true);
  }

  private checkInside(at: TCoord): void {
    if (!this.board.contains(at)) {
      throw new RangeError(`The coordinate ${this.board.key(at)} is outside the board.`);
    }
  }

  // The source is a value, so the copy shares it.
  clone(): SortState<TCoord> {
    return new SortState(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.source,
      this.goalsNeeded,
      this.offered,
      this.goalsDone,
      [...this.clearedTiles],
      this.placedAt,
      this.score,
    );
  }
}
