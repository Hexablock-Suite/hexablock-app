import type { Board, ReadonlyBoard } from '../../engine/board/board';
import { BoardSnapshot, checkOwnSnapshot, type BoardState } from '../../engine/board/board-state';
import type { GameEvent } from '../../engine/events/game-events';
import type { GameId } from '../../shared/game-id';
import type { GameStateId } from '../../engine/board/game-state-id';
import type { MatchId } from '../../engine/match-id';
import { Moves } from '../../shared/moves';
import { Score } from '../../shared/score';
import type { IPieceSource } from '../../engine/random/piece-source';
import { ClearedStacks } from './cleared-stacks';
import { ColorStack } from './color-stack';
import type { GoalCount } from './goal-count';
import type { PlaceStack } from './place-stack';
import { StackCleared } from './stack-cleared';
import type { TileCount } from './tile-count';

// The tray holds 3 stacks, as the team prototype (issue #353, decision of 2026-11-24).
// Only this file reads the size.
const TRAY_SIZE = 3;

// The slots of the tray, from the first slot. An empty slot holds `undefined`.
// The list is frozen, so a slot changes only when the state replaces the whole tray.
export type SortTray = readonly (ColorStack | undefined)[];

// The receiver of the data of a `SortView`. An adapter of the edge implements it,
// for example the state mapper of the Sort screen. No code of `src/domain/` or
// `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface SortViewReceiver {
  receive(tray: SortTray, goalsDone: ClearedStacks, goalsNeeded: GoalCount): void;
}

// The data that the Sort screen draws: the slots of the tray and the goal counts (issue #353).
// Every field is private (issue #245). A stack, a frozen tray and a count never change,
// so the view shares them, and `deliverTo()` gives them to an adapter of the edge.
// The view holds no coordinate, so it takes no `TCoord` (issue #423).
export class SortView {
  private readonly tray: SortTray;

  constructor(
    tray: SortTray,
    private readonly goalsDone: ClearedStacks,
    private readonly goalsNeeded: GoalCount,
  ) {
    this.tray = Object.freeze([...tray]);
    Object.freeze(this);
  }

  // Gives the slots of the tray and the two goal counts to `receiver`. It returns nothing.
  deliverTo(receiver: SortViewReceiver): void {
    receiver.receive(this.tray, this.goalsDone, this.goalsNeeded);
  }
}

// The photo of a Sort state (classes.md decision 34): the board, the score, the tray,
// the goals, the move count, the facts of the last turn and the piece source at its position.
// The source is a value (classes.md decision 51), so the photo shares it with the state,
// and a reader that draws from it changes nothing.
// `view()` gives the slots of the tray and the goal counts for the screen.
// Every field is private (issue #245). The rules ask `trayStacks()`, `lastPlacedAt()`,
// `goalsReached()` and `goal()`, the scoring asks `clearedStackHeights()`, and
// `SortState.restore()` asks the facts of the state, and `GameEngine` asks
// `eventsOfLastMove()` (issue #361). The photo keeps a frozen copy of the tray, a frozen list
// of the cleared heights and one of the cleared cells, and it is frozen itself.
// The cleared cells come last and are optional, so a photo that a test builds with heights only
// keeps working. Such a photo gives no event.
export class SortSnapshot<TCoord> extends BoardSnapshot<ColorStack, TCoord> {
  private readonly tray: SortTray;
  private readonly clearedTiles: readonly TileCount[];
  private readonly clearedAt: readonly TCoord[];

  constructor(
    stateId: GameStateId,
    matchId: MatchId,
    board: ReadonlyBoard<ColorStack, TCoord>,
    score: Score,
    tray: SortTray,
    private readonly goalsDone: ClearedStacks,
    private readonly goalsNeeded: GoalCount,
    clearedTiles: readonly TileCount[],
    private readonly placedAt: TCoord | undefined,
    private readonly source: IPieceSource<ColorStack>,
    private readonly moves: Moves,
    private readonly shown: SortView,
    clearedAt: readonly TCoord[] = [],
  ) {
    super(stateId, matchId, board, score);
    this.tray = Object.freeze([...tray]);
    this.clearedTiles = Object.freeze([...clearedTiles]);
    this.clearedAt = Object.freeze([...clearedAt]);
    Object.freeze(this);
  }

  // The slots of the tray, from the first slot. An empty slot holds `undefined`.
  trayStacks(): SortTray {
    return this.tray;
  }

  // The count of the accepted moves of the game.
  moveCount(): Moves {
    return this.moves;
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

  // The cell of each stack that the last turn cleared, in the order of the clears.
  // Only `SortState.restore()` needs it.
  clearedStackCells(): readonly TCoord[] {
    return this.clearedAt;
  }

  // One `StackCleared` event for each stack that the last turn cleared, in the order of
  // the clears (issue #361). Each event pairs a cleared cell with the height of its stack.
  eventsOfLastMove(game: GameId, match: MatchId): readonly GameEvent[] {
    return this.clearedAt.flatMap((at, i) => {
      const height = this.clearedTiles[i];
      return height === undefined ? [] : [new StackCleared(game, match, at, height)];
    });
  }

  // The cell of the last placed stack, or `undefined` before the first move.
  lastPlacedAt(): TCoord | undefined {
    return this.placedAt;
  }

  // The piece source at its position. Only `SortState.restore()` needs it.
  pieceSource(): IPieceSource<ColorStack> {
    return this.source;
  }

  view(): SortView {
    return this.shown;
  }
}

// The state of one Hexa Sort game (classes.md, Hexa Sort view).
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// It changes only through `placeStack()`, `moveRun()`, `clearStack()`,
// `countMove()`, `addPoints()` and `restore()`. The rules decide when to call them.
// A refused input throws a RangeError and leaves the whole state as it was.
// The scoring, the rules and the use cases ask the photo of `snapshot()`, never a field.
// The piece source lives in the state (classes.md decision 31). The level chooses it:
// seeded random or a fixed list (A4). The source gives each stack itself: Sort binds
// the `TPiece` of its factory to `ColorStack` (classes.md decision 6, issue #423).
// `tray` holds `TRAY_SIZE` slots (issue #353). The player places the stack of one slot,
// and that slot stays empty until the three slots are empty. Then the tray takes
// the next stacks of the source. A finite source can give fewer stacks, so the other slots
// stay empty: option A of #353, decided on 2026-11-27 (D29 of `docs/REQUIREMENTS.md`).
// An empty tray offers no move.
// `goalsDone` counts the cleared stacks, as a `ClearedStacks` (classes.md decision 42).
// `goalsNeeded` is the goal of the level, a `GoalCount`.
// `clearedTiles` holds the `TileCount` of each stack that the last turn cleared (issue #232),
// so the Sort scoring (issue #98) can read it. `clearedAt` holds the cell of each of those
// stacks, in the same order, so the photo gives one `StackCleared` event per stack (issue #361).
// `placedAt` is the cell of the last move.
export class SortState<TCoord> implements BoardState<ColorStack, TCoord> {
  private constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: Board<ColorStack, TCoord>,
    private source: IPieceSource<ColorStack>,
    private readonly goalsNeeded: GoalCount,
    private tray: SortTray,
    private goalsDone: ClearedStacks,
    private clearedTiles: TileCount[],
    private placedAt: TCoord | undefined,
    private score: Score,
    private moves: Moves = Moves.of(0),
    private clearedAt: TCoord[] = [],
  ) {}

  // A new game: no goals, moves or points yet, and a tray of the first stacks of the source.
  static start<TCoord>(values: {
    stateId: GameStateId;
    matchId: MatchId;
    board: Board<ColorStack, TCoord>;
    source: IPieceSource<ColorStack>;
    goalsNeeded: GoalCount;
  }): SortState<TCoord> {
    const state = new SortState(
      values.stateId,
      values.matchId,
      values.board,
      values.source,
      values.goalsNeeded,
      [],
      ClearedStacks.of(0),
      [],
      undefined,
      Score.of(0),
    );
    state.fillTray();
    return state;
  }

  // True when the slot of the move holds a stack and the cell of the move lies inside the board
  // with no stack, or with an empty stack. The state asks the move (classes.md decision 43).
  canPlace(move: PlaceStack<TCoord>): boolean {
    return move.stackIn(this.tray) !== undefined && this.isFree(move.cell());
  }

  // Puts the stack of the slot of the move on its cell, empties the slot and starts the facts
  // of a new turn. When the three slots are empty, the tray takes the next stacks of the source.
  // An empty slot, a cell outside the board or a cell with a stack throws a RangeError.
  placeStack(move: PlaceStack<TCoord>): void {
    const stack = move.stackIn(this.tray);
    if (stack === undefined) throw move.emptySlot();
    const at = move.cell();
    this.checkInside(at);
    if (!this.isFree(at)) {
      throw new RangeError('The cell already holds a stack.', { cause: this.board.key(at) });
    }
    this.board.occupy(at, stack);
    this.placedAt = at;
    this.clearedTiles = [];
    this.clearedAt = [];
    this.tray = Object.freeze(move.trayWithout(this.tray));
    if (this.tray.every((slot) => slot === undefined)) this.fillTray();
  }

  // Moves the top run of the stack at `from` onto the stack at `to`.
  // A cell `to` with no stack takes the run as a new stack.
  // A cell `from` with no tile, the same cell twice, or a cell `to` outside the board
  // throws a RangeError.
  moveRun(from: TCoord, to: TCoord): void {
    const giver = this.board.occupantAt(from);
    if (giver === undefined || giver.isEmpty()) {
      throw new RangeError('The cell has no stack to move.', { cause: this.board.key(from) });
    }
    this.checkInside(to);
    if (this.board.key(from).equals(this.board.key(to))) {
      throw new RangeError('A run cannot move to its own cell.', { cause: this.board.key(to) });
    }
    const receiver = this.board.occupantAt(to) ?? ColorStack.empty();
    this.board.occupy(from, giver.withoutTopRun());
    this.board.occupy(to, receiver.withOnTop(giver.topRun()));
  }

  // Removes the whole stack at `at` and counts one goal. The cell keeps an empty stack,
  // `clearedTiles` keeps the tile count of the stack for the scoring (#98), and `clearedAt`
  // keeps its cell for the event of the clear (issue #361).
  // A cell with no tile throws a RangeError.
  clearStack(at: TCoord): void {
    const stack = this.board.occupantAt(at);
    if (stack === undefined || stack.isEmpty()) {
      throw new RangeError('The cell has no stack to clear.', { cause: this.board.key(at) });
    }
    this.board.occupy(at, ColorStack.empty());
    this.goalsDone = this.goalsDone.plusOne();
    this.clearedTiles.push(stack.tileCount());
    this.clearedAt.push(at);
  }

  // Adds one move after an accepted placement.
  countMove(): void {
    this.moves = this.moves.plusOne();
  }

  // The engine adds the points of a turn in place. `Score.add()` refuses a total
  // above the largest safe integer, and the score stays as it was.
  addPoints(points: Score): void {
    this.score = this.score.add(points);
  }

  // The photo of the state now. A stack, a goal count and a coordinate never change,
  // and the source is a value, so the photo shares them.
  // It holds a frozen list and a copy of the board.
  snapshot(): SortSnapshot<TCoord> {
    return new SortSnapshot(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.score,
      this.tray,
      this.goalsDone,
      this.goalsNeeded,
      this.clearedTiles,
      this.placedAt,
      this.source,
      this.moves,
      new SortView(this.tray, this.goalsDone, this.goalsNeeded),
      this.clearedAt,
    );
  }

  // Takes back a photo of this state, in place: the whole tray, the empty slots included.
  // The goal of the level never changes, so the state keeps its own goal.
  // A photo of another state or of another board changes nothing.
  restore(snapshot: SortSnapshot<TCoord>): void {
    checkOwnSnapshot(this.stateId, this.board, snapshot);
    this.board.restore(snapshot.boardCopy());
    this.source = snapshot.pieceSource();
    this.tray = snapshot.trayStacks();
    this.goalsDone = snapshot.goalsReached();
    this.clearedTiles = [...snapshot.clearedStackHeights()];
    this.clearedAt = [...snapshot.clearedStackCells()];
    this.placedAt = snapshot.lastPlacedAt();
    this.score = snapshot.scoreSoFar();
    this.moves = snapshot.moveCount();
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
      throw new RangeError('The coordinate is outside the board.', { cause: this.board.key(at) });
    }
  }

  // Fills the `TRAY_SIZE` slots of the tray with the next stacks of the source.
  // A finite source can give fewer stacks, so each slot after its last stack stays empty.
  // Each draw gives the next source, and the state keeps the source after the last draw.
  private fillTray(): void {
    const tray: (ColorStack | undefined)[] = [];
    let source = this.source;
    while (tray.length < TRAY_SIZE) {
      if (source.hasNext()) {
        const [stack, rest] = source.take();
        tray.push(stack);
        source = rest;
      } else {
        tray.push(undefined);
      }
    }
    this.tray = Object.freeze(tray);
    this.source = source;
  }

  // The source and the frozen tray are values, so the copy shares them.
  clone(): SortState<TCoord> {
    return new SortState(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.source,
      this.goalsNeeded,
      this.tray,
      this.goalsDone,
      [...this.clearedTiles],
      this.placedAt,
      this.score,
      this.moves,
      [...this.clearedAt],
    );
  }
}
