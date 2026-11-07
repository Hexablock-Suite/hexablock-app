import type { Board } from '../../engine/board';
import type { PieceId } from './piece-id';

// Right: a type alias names the engine `Board` with the cell type of the variant.
export type FitBoard<TCoord> = Board<PieceId, TCoord, string>;

// Right: an interface is a contract, not a board class. It holds no cells.
export interface FitBoardView<TCoord> {
  readonly board: FitBoard<TCoord>;
}
