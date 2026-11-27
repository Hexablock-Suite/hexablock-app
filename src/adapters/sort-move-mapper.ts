import { PlaceStack } from '../domain/variants/hexa-sort/place-stack';
import { TraySlot } from '../domain/variants/hexa-sort/tray-slot';
import type { MoveMapper } from './move-mapper';

// The intent of the Sort controls: the index of the chosen tray slot and the pressed space
// that takes its stack (issue #353).
export interface SortIntent<TCoord> {
  readonly slot: number;
  readonly at: TCoord;
}

// The move mapper of Hexa Sort (classes.md decision 14, issue #405). It turns the index of
// the tray slot into a `TraySlot` and builds the `PlaceStack` on the pressed space (#353).
export class SortMoveMapper<TCoord> implements MoveMapper<SortIntent<TCoord>, PlaceStack<TCoord>> {
  toMove({ slot, at }: SortIntent<TCoord>): PlaceStack<TCoord> {
    return PlaceStack.on(TraySlot.of(slot), at);
  }
}
