import type { ValueReceiver } from '../domain/shared/value-receiver';
import type { ColorStack } from '../domain/variants/hexa-sort/color-stack';
import type { SortView } from '../domain/variants/hexa-sort/sort-state';
import type { StateMapper } from './state-mapper';

export interface SortCellView {
  // Bottom to top. A free space has no colors.
  readonly colors: readonly string[];
}

export interface SortPayloadView {
  // One view for each slot of the tray, from the first slot. An empty slot has no colors.
  readonly tray: readonly SortCellView[];
  readonly goalsDone: number;
  readonly goalsNeeded: number;
}

const FREE: SortCellView = Object.freeze({ colors: Object.freeze([]) });

// The mapper of the Sort screen. The view of a Sort state holds no coordinate,
// so the mapper takes no `TCoord` (issue #423).
export class SortStateMapper implements StateMapper<
  ColorStack,
  SortView,
  SortCellView,
  SortPayloadView
> {
  toView(cell: ColorStack): SortCellView {
    const colors = valueOf(cell);
    return colors.length === 0 ? FREE : { colors: colors.map((color) => valueOf(color)) };
  }

  freeView(): SortCellView {
    return FREE;
  }

  toPayload(payload: SortView): SortPayloadView {
    let view: SortPayloadView | undefined;
    payload.deliverTo({
      receive: (tray, goalsDone, goalsNeeded) => {
        view = {
          tray: tray.map((slot) => (slot === undefined ? FREE : this.toView(slot))),
          goalsDone: valueOf(goalsDone),
          goalsNeeded: valueOf(goalsNeeded),
        };
      },
    });
    if (view === undefined) throw new Error('The Sort view delivered no data.');
    return view;
  }
}

function valueOf<T>(source: { deliverTo(receiver: ValueReceiver<T>): void }): T {
  let value: T | undefined;
  source.deliverTo({
    receive: (delivered) => {
      value = delivered;
    },
  });
  if (value === undefined) throw new Error('The Sort value delivered no data.');
  return value;
}
