import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { Piece } from '../../engine/piece';
import type { IPieceSource } from '../../engine/piece-source';
import type { Color } from './color';

// The state of one Hexa Lines game: the board of colors, the tray and the piece source.
// The source lives in the state, so the engine copy and rollback cover it (classes.md decision 31).
// `streak` and `linesCleared` follow the proposal on issue 58, «Propuesta, pendiente del equipo».
// `linesCleared` is the combo of the last placement: the count of distinct full lines it cleared.
// `streak` counts the placements in a row that cleared at least one line.
// The scoring of issue 97 reads both fields.
export class LinesState<TCoord> implements BoardState<Color, TCoord> {
  constructor(
    readonly board: Board<Color, TCoord, string>,
    public tray: readonly Piece<Color, TCoord>[],
    readonly source: IPieceSource<Piece<Color, TCoord>>,
    public streak = 0,
    public linesCleared = 0,
    public score = 0,
  ) {}

  // Pieces never change, so the tray copy shares them.
  clone(): LinesState<TCoord> {
    return new LinesState(
      this.board.clone(),
      [...this.tray],
      this.source.clone(),
      this.streak,
      this.linesCleared,
      this.score,
    );
  }
}
