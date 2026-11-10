import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { Color } from '../../engine/color';
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

// The state of one Hexa Lines game: the board of colors, the tray and the piece source.
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// It changes only through `placePiece()`, `clearLines()` and `addPoints()`.
// A refused input throws a RangeError and leaves the whole state as it was.
// The fields stay public, because the scoring, the rules and the use cases read them.
// The source lives in the state, so the engine copy and rollback cover it (classes.md decision 31).
// `streak` and `linesCleared` follow the proposal on issue 58, «Propuesta, pendiente del equipo».
// `linesCleared` is the combo of the last placement: the count of distinct full lines it cleared.
// `streak` counts the placements in a row that cleared at least one line.
// `cellsPlaced` is the count of cells that the last placement put on the board.
// The scoring of issue 97 reads the three fields, because the policy keeps no game data.
// The constructor checks its values: a tray of at most `TRAY_SIZE` pieces, three counts
// that are whole numbers of 0 or more, and a finite score.
export class LinesState<TCoord> implements BoardState<Color, TCoord> {
  constructor(
    readonly board: Board<Color, TCoord, string>,
    public tray: readonly Piece<Color, TCoord>[],
    readonly source: IPieceSource<Piece<Color, TCoord>>,
    public streak = 0,
    public linesCleared = 0,
    public cellsPlaced = 0,
    public score = 0,
  ) {
    if (tray.length > TRAY_SIZE) {
      throw new RangeError(`A Lines tray holds at most ${TRAY_SIZE} pieces, not ${tray.length}.`);
    }
    checkCount('streak', streak);
    checkCount('linesCleared', linesCleared);
    checkCount('cellsPlaced', cellsPlaced);
    if (!Number.isFinite(score)) {
      throw new RangeError(`The score of a state must be a finite number, not ${score}.`);
    }
  }

  // A new game: the board and a full tray from the source.
  static start<TCoord>(
    board: Board<Color, TCoord, string>,
    source: IPieceSource<Piece<Color, TCoord>>,
  ): LinesState<TCoord> {
    const state = new LinesState(board, [], source);
    state.drawTray();
    return state;
  }

  // True when the tray has a piece at the index of the move, and each cell of that piece
  // at the offset `at` lies inside the board on a free cell.
  canPlace(move: PlacePiece<TCoord>): boolean {
    const piece = this.tray[move.trayIndex];
    return piece !== undefined && this.fits(piece, move.at);
  }

  // Puts the tray piece on the board and takes it from the tray.
  // When the tray is empty, the next pieces of the source fill it.
  // A missing tray piece, or a piece that does not fit, throws a RangeError.
  placePiece(move: PlacePiece<TCoord>): void {
    const piece = this.tray[move.trayIndex];
    if (piece === undefined) {
      throw new RangeError(`The tray has no piece at index ${move.trayIndex}.`);
    }
    if (!this.fits(piece, move.at)) {
      throw new RangeError(
        `The piece at tray index ${move.trayIndex} does not fit at ${this.board.topology.key(move.at)}.`,
      );
    }
    const cells = this.cellsOf(piece, move.at);
    for (const c of cells) this.board.occupy(c, piece.content);
    this.cellsPlaced = cells.length;
    this.tray = this.tray.filter((_, i) => i !== move.trayIndex);
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
        throw new RangeError(`A cleared line holds the free cell ${this.board.topology.key(c)}.`);
      }
      cleared.set(this.board.topology.key(c), c);
    }
    for (const c of cleared.values()) this.board.vacate(c);
    this.streak = lines.length > 0 ? this.streak + 1 : 0;
    this.linesCleared = lines.length;
  }

  addPoints(points: number): void {
    if (!Number.isFinite(points)) {
      throw new RangeError(`The points of a turn must be a finite number, not ${points}.`);
    }
    this.score += points;
  }

  // Pieces never change, so the view shares them. `tray` is public and mutable,
  // so the view holds a frozen copy of the list.
  view(): LinesView<TCoord> {
    return Object.freeze({ tray: Object.freeze([...this.tray]) });
  }

  // Pieces never change, so the tray copy shares them.
  clone(): LinesState<TCoord> {
    return new LinesState(
      this.board.clone(),
      [...this.tray],
      this.source.clone(),
      this.streak,
      this.linesCleared,
      this.cellsPlaced,
      this.score,
    );
  }

  // Fills the tray with up to `TRAY_SIZE` pieces from the source. A finite source can give fewer.
  private drawTray(): void {
    const pieces: Piece<Color, TCoord>[] = [];
    for (const piece of this.source) {
      pieces.push(piece);
      if (pieces.length === TRAY_SIZE) break;
    }
    this.tray = pieces;
  }

  private cellsOf(piece: Piece<Color, TCoord>, at: TCoord): TCoord[] {
    return piece.translated(at, this.board.topology).shape.cells();
  }

  // A piece fits when each of its cells lies inside the board on a free cell.
  private fits(piece: Piece<Color, TCoord>, at: TCoord): boolean {
    return this.cellsOf(piece, at).every(
      (c) => this.board.contains(c) && this.board.get(c) === undefined,
    );
  }
}

// A count of the state is a whole number of 0 or more.
function checkCount(name: string, count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(
      `The ${name} of a Lines state must be a whole number of 0 or more, not ${count}.`,
    );
  }
}
