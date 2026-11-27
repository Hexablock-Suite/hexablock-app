import { PlaceStack } from '../domain/variants/hexa-sort/place-stack';
import type { MoveMapper } from './move-mapper';

// The intent of the Sort controls: the pressed space that takes the offered stack.
export interface SortIntent<TCoord> {
  readonly at: TCoord;
}

// The move mapper of Hexa Sort (classes.md decision 14, issue #405). It builds the `PlaceStack`
// on the pressed space.
export class SortMoveMapper<TCoord> implements MoveMapper<SortIntent<TCoord>, PlaceStack<TCoord>> {
  toMove({ at }: SortIntent<TCoord>): PlaceStack<TCoord> {
    return PlaceStack.on(at);
  }
}
