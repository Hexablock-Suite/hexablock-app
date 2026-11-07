import type * as engine from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { Color } from './color';

// Right: the state holds the engine `Board` through a namespace import.
export class LinesState<TCoord> implements BoardState<Color, TCoord> {
  constructor(readonly board: engine.Board<Color, TCoord, string>) {}
}
