import type { BoardState } from '../../engine/board-state';
import type { Color } from './color';
import type { LinesBoard } from './lines-board';

// Wrong on purpose: the state holds the board class of the variant, not the engine `Board`.
export class LinesState<TCoord> implements BoardState<Color, TCoord> {
  constructor(readonly board: LinesBoard<TCoord>) {}
}
