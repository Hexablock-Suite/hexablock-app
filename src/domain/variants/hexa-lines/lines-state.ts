import type { Board } from '../../engine/board';
import { checkOwnSnapshot, type BoardSnapshot, type BoardState } from '../../engine/board-state';
import type { Color } from '../../engine/color';
import type { GameStateId } from '../../engine/game-state-id';
import type { MatchId } from '../../engine/match-id';
import { Score } from '../../engine/score';
import type { CoordKey } from '../../engine/coord-key';
import type { Piece } from '../../engine/piece';
import type { IPieceSource } from '../../engine/piece-source';
import type { PlacePiece } from './place-piece';

// The tray holds 3 pieces (statement §1.1).
export const TRAY_SIZE = 3;

// The data that the Lines screen draws: the pieces of the tray.
export interface LinesView<TCoord> {
  readonly tray: readonly Piece<Color, TCoord>[];
}

// The photo of a Lines state (classes.md decision 34): the board, the score, the tray,
// the three facts of the last placement and the piece source at its position.
// The source is a value (classes.md decision 51), so the photo shares it with the state,
// and a reader that draws from it changes nothing. `view()` gives the tray for the screen.
export interface LinesSnapshot<TCoord> extends BoardSnapshot<Color, TCoord> {
  readonly tray: readonly Piece<Color, TCoord>[];
  readonly streak: number;
  readonly linesCleared: number;
  readonly cellsPlaced: number;
  readonly source: IPieceSource<Piece<Color, TCoord>>;
  view(): LinesView<TCoord>;
}

// The state of one Hexa Lines game: the board of colors, the tray and the piece source.
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// It changes only through `placePiece()`, `clearLines()`, `addPoints()` and `restore()`.
// A refused input throws a RangeError and leaves the whole state as it was.
// The scoring, the rules and the use cases read the photo of `snapshot()`, never a field.
// The source lives in the state, so the engine copy and rollback cover it (classes.md decision 31).
// The source is a value: a draw replaces it with the next source (classes.md decision 51).
// `streak` and `linesCleared` follow the proposal on issue 58, «Propuesta, pendiente del equipo».
// `linesCleared` is the combo of the last placement: the count of distinct full lines it cleared.
// `streak` counts the placements in a row that cleared at least one line.
// `cellsPlaced` is the count of cells that the last placement put on the board.
// The scoring of issue 97 reads the three fields, because the policy keeps no game data.
// The constructor checks its values: a tray of at most `TRAY_SIZE` pieces, three counts
// that are whole numbers of 0 or more. The score is a `Score`, which checks its own value.
export class LinesState<TCoord> implements BoardState<Color, TCoord> {
  constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: Board<Color, TCoord>,
    private tray: readonly Piece<Color, TCoord>[],
    private source: IPieceSource<Piece<Color, TCoord>>,
    private streak = 0,
    private linesCleared = 0,
    private cellsPlaced = 0,
    private score: Score = Score.of(0),
  ) {
    checkValues(tray, streak, linesCleared, cellsPlaced);
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
    for (const c of cells) this.board.occupy(c, piece.cell());
    this.cellsPlaced = cells.length;
    this.tray = move.trayWithout(this.tray);
    if (this.tray.length === 0) this.drawTray();
  }

  // Vacates every cell of the full lines. A cell that two lines share is vacated once.
  // The combo is the count of lines. The streak grows by one when the count is 1 or more,
  // and it goes back to 0 when the count is 0.
  // A line that holds a free cell, or a cell outside the board, throws a RangeError.
  clearLines(lines: readonly (readonly TCoord[])[]): void {
    const cleared = new Map<CoordKey, TCoord>();
    for (const c of lines.flat()) {
      if (this.board.get(c) === undefined) {
        throw new RangeError(`A cleared line holds the free cell ${this.board.key(c)}.`);
      }
      cleared.set(this.board.key(c), c);
    }
    for (const c of cleared.values()) this.board.vacate(c);
    this.streak = lines.length > 0 ? this.streak + 1 : 0;
    this.linesCleared = lines.length;
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
    const tray = Object.freeze([...this.tray]);
    const view = Object.freeze({ tray });
    return Object.freeze({
      stateId: this.stateId,
      matchId: this.matchId,
      board: this.board.clone(),
      score: this.score,
      tray,
      streak: this.streak,
      linesCleared: this.linesCleared,
      cellsPlaced: this.cellsPlaced,
      source: this.source,
      view: () => view,
    });
  }

  // Takes back a photo of this state, in place. The checks of the constructor run first,
  // so a photo of another state, of another board or with a wrong value changes nothing.
  restore(snapshot: LinesSnapshot<TCoord>): void {
    checkOwnSnapshot(this.stateId, this.board, snapshot);
    checkValues(snapshot.tray, snapshot.streak, snapshot.linesCleared, snapshot.cellsPlaced);
    this.board.restore(snapshot.board);
    this.tray = [...snapshot.tray];
    this.source = snapshot.source;
    this.streak = snapshot.streak;
    this.linesCleared = snapshot.linesCleared;
    this.cellsPlaced = snapshot.cellsPlaced;
    this.score = snapshot.score;
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
    );
  }

  // Fills the tray with up to `TRAY_SIZE` pieces from the source. A finite source can give fewer.
  // Each draw gives the next source, and the state keeps the source after the last draw.
  private drawTray(): void {
    const pieces: Piece<Color, TCoord>[] = [];
    let source = this.source;
    while (pieces.length < TRAY_SIZE && source.hasNext()) {
      const { piece, rest } = source.take();
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
    return cells.every((c) => this.board.contains(c) && this.board.get(c) === undefined);
  }
}

// The checks of the constructor: a tray of at most `TRAY_SIZE` pieces and three counts.
function checkValues(
  tray: readonly unknown[],
  streak: number,
  linesCleared: number,
  cellsPlaced: number,
): void {
  if (tray.length > TRAY_SIZE) {
    throw new RangeError(`A Lines tray holds at most ${TRAY_SIZE} pieces, not ${tray.length}.`);
  }
  checkCount('streak', streak);
  checkCount('linesCleared', linesCleared);
  checkCount('cellsPlaced', cellsPlaced);
}

// A count of the state is a whole number of 0 or more.
function checkCount(name: string, count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(
      `The ${name} of a Lines state must be a whole number of 0 or more, not ${count}.`,
    );
  }
}
