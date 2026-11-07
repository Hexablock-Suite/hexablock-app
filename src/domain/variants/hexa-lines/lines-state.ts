import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { Color } from '../../engine/color';
import type { Piece } from '../../engine/piece';
import type { IPieceSource } from '../../engine/piece-source';

// The tray holds 3 pieces (statement §1.1).
export const TRAY_SIZE = 3;

// The state of one Hexa Lines game: the board of colors, the tray and the piece source.
// The source lives in the state, so the engine copy and rollback cover it (classes.md decision 31).
// `streak` and `linesCleared` follow the proposal on issue 58, «Propuesta, pendiente del equipo».
// `linesCleared` is the combo of the last placement: the count of distinct full lines it cleared.
// `streak` counts the placements in a row that cleared at least one line.
// `cellsPlaced` is the count of cells that the last placement put on the board.
// The scoring of issue 97 reads the three fields, because the policy keeps no game data.
export class LinesState<TCoord> implements BoardState<Color, TCoord> {
  constructor(
    readonly board: Board<Color, TCoord, string>,
    public tray: readonly Piece<Color, TCoord>[],
    readonly source: IPieceSource<Piece<Color, TCoord>>,
    public streak = 0,
    public linesCleared = 0,
    public cellsPlaced = 0,
    public score = 0,
  ) {}

  // A new game: the board and a full tray from the source.
  static start<TCoord>(
    board: Board<Color, TCoord, string>,
    source: IPieceSource<Piece<Color, TCoord>>,
  ): LinesState<TCoord> {
    return new LinesState(board, drawTray(source), source);
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
}

// Up to `TRAY_SIZE` pieces from the source. A finite source can give fewer.
export function drawTray<TCoord>(
  source: IPieceSource<Piece<Color, TCoord>>,
): Piece<Color, TCoord>[] {
  const pieces: Piece<Color, TCoord>[] = [];
  for (const piece of source) {
    pieces.push(piece);
    if (pieces.length === TRAY_SIZE) break;
  }
  return pieces;
}
