import type { BoardState } from '../../engine/board-state';
import type { ColorStack } from './color-stack';

// Wrong on purpose: the state keeps its cells in a map, not in the engine `Board`.
export class SortState<TCoord> implements BoardState<ColorStack, TCoord> {
  readonly board = new Map<string, [TCoord, ColorStack]>();
}
