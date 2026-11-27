import type { Color } from '../domain/engine/color';
import type { LinesView } from '../domain/variants/hexa-lines/lines-state';
import { onlyValue, valueOf } from './delivered';
import type { StateMapper } from './state-mapper';

export interface LinesCellView {
  readonly color?: string;
}

export interface LinesTrayPiece<TCoord> {
  readonly color: string;
  readonly cells: readonly TCoord[];
}

export interface LinesPayloadView<TCoord> {
  readonly tray: readonly LinesTrayPiece<TCoord>[];
}

const FREE: LinesCellView = Object.freeze({});

export class LinesStateMapper<TCoord> implements StateMapper<
  Color,
  LinesView<TCoord>,
  LinesCellView,
  LinesPayloadView<TCoord>
> {
  toView(cell: Color): LinesCellView {
    return { color: valueOf(cell) };
  }

  freeView(): LinesCellView {
    return FREE;
  }

  // A view that delivers no data, or delivers it twice, throws an Error (issue #408).
  toPayload(payload: LinesView<TCoord>): LinesPayloadView<TCoord> {
    return onlyValue<LinesPayloadView<TCoord>>((keep) =>
      payload.deliverTo({
        receive: (tray) =>
          keep({
            tray: tray.map((piece) => ({
              color: valueOf(piece.occupant()),
              cells: piece.coveredCoordinates(),
            })),
          }),
      }),
    );
  }
}
