import type { Board, ReadonlyBoard } from '../../engine/board';
import { BoardSnapshot, checkOwnSnapshot, type BoardState } from '../../engine/board-state';
import type { Color } from '../../engine/color';
import type { GameEvent } from '../../engine/game-events';
import type { GameId } from '../../engine/game-id';
import type { GameStateId } from '../../engine/game-state-id';
import type { MatchId } from '../../engine/match-id';
import { Score } from '../../engine/score';
import { CoordKeyMap } from '../../engine/coord-key-map';
import type { Piece } from '../../engine/piece';
import type { IPieceSource } from '../../engine/piece-source';
import { CellCount } from './cell-count';
import { LineCount } from './line-count';
import { LinesCleared } from './lines-cleared';
import type { PlacePiece } from './place-piece';
import { Streak } from './streak';

// The tray holds 3 pieces (statement §1.1). Only this file reads the size (issue #232).
const TRAY_SIZE = 3;

// The receiver of the data of a `LinesView`. An adapter of the edge implements it,
// for example the state mapper of the Lines screen. No code of `src/domain/` or
// `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface LinesViewReceiver<TCoord> {
  receive(tray: readonly Piece<Color, TCoord>[]): void;
}

// The data that the Lines screen draws: the pieces of the tray.
// The field is private (issue #245). The view keeps a frozen copy of the tray, so a later
// change of the state never reaches it, and `deliverTo()` gives the tray to an adapter of the edge.
export class LinesView<TCoord> {
  private readonly tray: readonly Piece<Color, TCoord>[];

  constructor(tray: readonly Piece<Color, TCoord>[]) {
    this.tray = Object.freeze([...tray]);
    Object.freeze(this);
  }

  // Gives the pieces of the tray to `receiver`. It returns nothing.
  deliverTo(receiver: LinesViewReceiver<TCoord>): void {
    receiver.receive(this.tray);
  }
}

// The photo of a Lines state (classes.md decision 34): the board, the score, the tray,
// the facts of the last placement and the piece source at its position.
// The source is a value (classes.md decision 51), so the photo shares it with the state,
// and a reader that draws from it changes nothing. `view()` gives the tray for the screen.
// Every field is private (issue #245). The rules ask `trayPieces()`, the scoring asks
// `lastPlacedCells()`, `lastCombo()` and `currentStreak()`, and `LinesState.restore()` asks
// every query. `GameEngine` asks `eventsOfLastMove()` (issue #361).
// The photo keeps a frozen copy of the tray and of the cleared cells, and it is frozen itself.
export class LinesSnapshot<TCoord> extends BoardSnapshot<Color, TCoord> {
  private readonly tray: readonly Piece<Color, TCoord>[];
  private readonly clearedCells: readonly TCoord[];

  constructor(
    stateId: GameStateId,
    matchId: MatchId,
    board: ReadonlyBoard<Color, TCoord>,
    score: Score,
    tray: readonly Piece<Color, TCoord>[],
    private readonly streak: Streak,
    private readonly linesCleared: LineCount,
    private readonly cellsPlaced: CellCount,
    clearedCells: readonly TCoord[],
    private readonly source: IPieceSource<Piece<Color, TCoord>>,
    private readonly shown: LinesView<TCoord>,
  ) {
    super(stateId, matchId, board, score);
    this.tray = Object.freeze([...tray]);
    this.clearedCells = Object.freeze([...clearedCells]);
    Object.freeze(this);
  }

  // The pieces of the tray, in the order of the tray.
  trayPieces(): readonly Piece<Color, TCoord>[] {
    return this.tray;
  }

  // The placements in a row that cleared at least one line, the last placement included.
  currentStreak(): Streak {
    return this.streak;
  }

  // The combo of the last placement: the count of distinct full lines that it cleared.
  lastCombo(): LineCount {
    return this.linesCleared;
  }

  // The count of cells that the last placement put on the board.
  lastPlacedCells(): CellCount {
    return this.cellsPlaced;
  }

  // The cells that the last placement cleared, in the order of the wave: the order in which
  // the rules found the full lines, each cell once. Only `LinesState.restore()` needs it.
  lastClearedCells(): readonly TCoord[] {
    return this.clearedCells;
  }

  // The piece source at its position. Only `LinesState.restore()` needs it.
  pieceSource(): IPieceSource<Piece<Color, TCoord>> {
    return this.source;
  }

  // One `LinesCleared` event when the last placement cleared a line, or none (issue #361).
  eventsOfLastMove(game: GameId, match: MatchId): readonly GameEvent[] {
    if (this.linesCleared.isNone()) return [];
    return [new LinesCleared(game, match, this.linesCleared, this.clearedCells)];
  }

  view(): LinesView<TCoord> {
    return this.shown;
  }
}

// The state of one Hexa Lines game: the board of colors, the tray and the piece source.
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// It changes only through `placePiece()`, `clearLines()`, `addPoints()` and `restore()`.
// A refused input throws a RangeError and leaves the whole state as it was.
// The scoring, the rules and the use cases ask the photo of `snapshot()`, never a field.
// The source lives in the state, so the engine copy and rollback cover it (classes.md decision 31).
// The source is a value: a draw replaces it with the next source (classes.md decision 51).
// `streak` and `linesCleared` follow the proposal on issue 58, «Propuesta, pendiente del equipo».
// `linesCleared` is the combo of the last placement: the count of distinct full lines it cleared.
// `streak` counts the placements in a row that cleared at least one line.
// `cellsPlaced` is the count of cells that the last placement put on the board.
// `clearedCells` holds the cells that the last placement cleared, in the order of the wave.
// The photo gives the `LinesCleared` event of the placement from it (issue #361).
// The scoring of issue 97 reads the three fields, because the policy keeps no game data.
// The three counts are value objects (issue #232): a `Streak`, a `LineCount` and a `CellCount`.
// Each one checks its own value, and the score is a `Score`, which checks its own value too.
// The constructor checks the tray: it holds at most `TRAY_SIZE` pieces.
export class LinesState<TCoord> implements BoardState<Color, TCoord> {
  constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: Board<Color, TCoord>,
    private tray: readonly Piece<Color, TCoord>[],
    private source: IPieceSource<Piece<Color, TCoord>>,
    private streak: Streak = Streak.of(0),
    private linesCleared: LineCount = LineCount.of(0),
    private cellsPlaced: CellCount = CellCount.of(0),
    private score: Score = Score.of(0),
    private clearedCells: readonly TCoord[] = [],
  ) {
    checkTray(tray);
  }

  // A new game: the board and a full tray from the source.
  static start<TCoord>(
    stateId: GameStateId,
    matchId: MatchId,
    board: Board<Color, TCoord>,
    source: IPieceSource<Piece<Color, TCoord>>,
  ): LinesState<TCoord> {
    const state = new LinesState(stateId, matchId, board, [], source);
    state.drawTray();
    return state;
  }

  // True when the tray has the piece that the move names, and each cell of that piece
  // at the offset of the move lies inside the board on a free cell.
  // The state reads no field of the move: it asks the move (classes.md decision 43).
  canPlace(move: PlacePiece<TCoord>): boolean {
    const piece = move.pieceIn(this.tray);
    return piece !== undefined && this.fits(this.cellsOf(piece, move));
  }

  // Puts the tray piece on the board and takes it from the tray.
  // When the tray is empty, the next pieces of the source fill it.
  // A missing tray piece, or a piece that does not fit, throws a RangeError.
  placePiece(move: PlacePiece<TCoord>): void {
    const piece = move.pieceIn(this.tray);
    if (piece === undefined) throw move.missingPiece();
    const cells = this.cellsOf(piece, move);
    if (!this.fits(cells)) throw move.misfit(this.board);
    for (const c of cells) this.board.occupy(c, piece.occupant());
    this.cellsPlaced = CellCount.of(cells.length);
    this.tray = move.trayWithout(this.tray);
    if (this.tray.length === 0) this.drawTray();
  }

  // Vacates every cell of the full lines. A cell that two lines share is vacated once.
  // The state keeps the vacated cells in the order of the lines and of their cells.
  // The combo is the count of lines. The streak grows by one when the count is 1 or more,
  // and it goes back to 0 when the count is 0.
  // A line that holds a free cell, or a cell outside the board, throws a RangeError.
  // The new counts exist before the first vacated cell, so a refused count changes nothing.
  clearLines(lines: readonly (readonly TCoord[])[]): void {
    const cleared = new CoordKeyMap<TCoord>();
    for (const c of lines.flat()) {
      if (this.board.occupantAt(c) === undefined) {
        throw new RangeError('A cleared line holds a free cell.', { cause: this.board.key(c) });
      }
      cleared.set(this.board.key(c), c);
    }
    const linesCleared = LineCount.of(lines.length);
    const streak = this.streak.after(linesCleared);
    const clearedCells = cleared.values();
    for (const c of clearedCells) this.board.vacate(c);
    this.streak = streak;
    this.linesCleared = linesCleared;
    this.clearedCells = clearedCells;
  }

  // The engine adds the points of a turn in place. `Score.add()` refuses a total
  // above the largest safe integer, and the score stays as it was.
  addPoints(points: Score): void {
    this.score = this.score.add(points);
  }

  // True when this state is the state of the match `match`.
  belongsTo(match: MatchId): boolean {
    return this.matchId.equals(match);
  }

  // Two states with one `GameStateId` are the same state.
  // Their matches, their boards, their scores and their other values do not count.
  equals(other: BoardState<Color, TCoord>): boolean {
    return other instanceof LinesState && this.stateId.equals(other.stateId);
  }

  // The photo of the state now. Pieces never change, so the photo shares them.
  // The source is a value, so the photo shares it too.
  // The tray and the board change, so the photo holds a frozen list and a copy of the board.
  snapshot(): LinesSnapshot<TCoord> {
    return new LinesSnapshot(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.score,
      this.tray,
      this.streak,
      this.linesCleared,
      this.cellsPlaced,
      this.clearedCells,
      this.source,
      new LinesView(this.tray),
    );
  }

  // Takes back a photo of this state, in place. The checks of the constructor run first,
  // so a photo of another state, of another board or with a wrong tray changes nothing.
  restore(snapshot: LinesSnapshot<TCoord>): void {
    checkOwnSnapshot(this.stateId, this.board, snapshot);
    const tray = snapshot.trayPieces();
    checkTray(tray);
    this.board.restore(snapshot.boardCopy());
    this.tray = [...tray];
    this.source = snapshot.pieceSource();
    this.streak = snapshot.currentStreak();
    this.linesCleared = snapshot.lastCombo();
    this.cellsPlaced = snapshot.lastPlacedCells();
    this.clearedCells = snapshot.lastClearedCells();
    this.score = snapshot.scoreSoFar();
  }

  // Pieces and the source never change, so the copy shares them.
  clone(): LinesState<TCoord> {
    return new LinesState(
      this.stateId,
      this.matchId,
      this.board.clone(),
      [...this.tray],
      this.source,
      this.streak,
      this.linesCleared,
      this.cellsPlaced,
      this.score,
      this.clearedCells,
    );
  }

  // Fills the tray with up to `TRAY_SIZE` pieces from the source. A finite source can give fewer.
  // Each draw gives the next source, and the state keeps the source after the last draw.
  private drawTray(): void {
    const pieces: Piece<Color, TCoord>[] = [];
    let source = this.source;
    while (pieces.length < TRAY_SIZE && source.hasNext()) {
      const [piece, rest] = source.take();
      pieces.push(piece);
      source = rest;
    }
    this.tray = pieces;
    this.source = source;
  }

  // The board cells that the piece covers at the offset of the move.
  private cellsOf(piece: Piece<Color, TCoord>, move: PlacePiece<TCoord>): TCoord[] {
    return move.cells(piece, this.board);
  }

  // A piece fits when each of its cells lies inside the board on a free cell.
  private fits(cells: readonly TCoord[]): boolean {
    return cells.every((c) => this.board.contains(c) && this.board.occupantAt(c) === undefined);
  }
}

// The check of the constructor: a tray of at most `TRAY_SIZE` pieces.
function checkTray(tray: readonly unknown[]): void {
  if (tray.length > TRAY_SIZE) {
    throw new RangeError(`A Lines tray holds at most ${TRAY_SIZE} pieces, not ${tray.length}.`);
  }
}
