import type { Color } from '../domain/engine/color';
import type { LinesView } from '../domain/variants/hexa-lines/lines-state';
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
    return { color: nameOf(cell) };
  }

  freeView(): LinesCellView {
    return FREE;
  }

  toPayload(payload: LinesView<TCoord>): LinesPayloadView<TCoord> {
    let view: LinesPayloadView<TCoord> | undefined;
    payload.deliverTo({
      receive: (tray) => {
        view = {
          tray: tray.map((piece) => ({
            color: nameOf(piece.occupant()),
            cells: piece.coveredCoordinates(),
          })),
        };
      },
    });
    if (view === undefined) throw new Error('The Lines view delivered no data.');
    return view;
  }
}

function nameOf(color: Color): string {
  let name: string | undefined;
  color.deliverTo({
    receive: (value) => {
      name = value;
    },
  });
  if (name === undefined) throw new Error('The color delivered no name.');
  return name;
}
