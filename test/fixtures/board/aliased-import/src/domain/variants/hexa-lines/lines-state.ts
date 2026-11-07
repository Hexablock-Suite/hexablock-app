import type { Board as Grid } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { Color } from './color';

// Right: the state holds the engine `Board` under an import alias.
export class LinesState<TCoord> implements BoardState<Color, TCoord> {
  constructor(readonly board: Grid<Color, TCoord, string>) {}
}
