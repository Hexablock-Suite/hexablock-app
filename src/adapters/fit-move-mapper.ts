import { Turns } from '../domain/engine/turns';
import { PlaceFitPiece, RemoveFitPiece, type FitMove } from '../domain/variants/hexa-fit/fit-move';
import { PieceId } from '../domain/variants/hexa-fit/piece-id';
import type { MoveMapper } from './move-mapper';

// The intent of the Fit controls. `place` puts the piece with the text id `piece`, at the rotation
// step `rotation`, on the pressed space `at`. `remove` takes the piece `piece` back to the tray.
export type FitIntent<TCoord> =
  | {
      readonly kind: 'place';
      readonly piece: string;
      readonly rotation: number;
      readonly at: TCoord;
    }
  | { readonly kind: 'remove'; readonly piece: string };

// The move mapper of Hexa Fit (classes.md decision 14, issue #405). It turns the text id into
// a `PieceId` and the rotation step into `Turns`, and builds `PlaceFitPiece` or `RemoveFitPiece`.
// The board figure can give the step from the pressed space and the rotation step to the offset
// of the move, as the triangle does (#365). With no step, the offset is the pressed space.
export class FitMoveMapper<TCoord> implements MoveMapper<FitIntent<TCoord>, FitMove<TCoord>> {
  constructor(private readonly placementAt: (at: TCoord, rotation: Turns) => TCoord = (at) => at) {}

  toMove(intent: FitIntent<TCoord>): FitMove<TCoord> {
    if (intent.kind === 'remove') return new RemoveFitPiece(PieceId.of(intent.piece));
    const rotation = Turns.of(intent.rotation);
    return new PlaceFitPiece(
      PieceId.of(intent.piece),
      rotation,
      this.placementAt(intent.at, rotation),
    );
  }
}
