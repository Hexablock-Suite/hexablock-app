import { PlacePiece } from '../domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../domain/variants/hexa-lines/tray-position';
import type { MoveMapper } from './move-mapper';

// The intent of the Lines controls: the index of the chosen tray piece and the pressed space.
export interface LinesIntent<TCoord> {
  readonly position: number;
  readonly at: TCoord;
}

// The move mapper of Hexa Lines (classes.md decision 14, issue #405). It turns the index of
// the tray piece into a `TrayPosition` and builds the `PlacePiece`. The board figure can give
// the step from the pressed space to the offset of the move, as the triangle does (#174).
// With no step, the offset is the pressed space.
export class LinesMoveMapper<TCoord> implements MoveMapper<
  LinesIntent<TCoord>,
  PlacePiece<TCoord>
> {
  constructor(private readonly placementAt: (at: TCoord) => TCoord = (at) => at) {}

  toMove({ position, at }: LinesIntent<TCoord>): PlacePiece<TCoord> {
    return new PlacePiece(TrayPosition.of(position), this.placementAt(at));
  }
}
