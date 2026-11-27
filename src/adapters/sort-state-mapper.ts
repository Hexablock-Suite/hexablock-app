import type { ColorStack } from '../domain/variants/hexa-sort/color-stack';
import type { SortView } from '../domain/variants/hexa-sort/sort-state';
import { onlyValue, valueOf } from './delivered';
import type { StateMapper } from './state-mapper';

export interface SortCellView {
  // Bottom to top. A free space has no colors.
  readonly colors: readonly string[];
}

export interface SortPayloadView {
  readonly offered?: SortCellView;
  readonly goalsDone: number;
  readonly goalsNeeded: number;
}

const FREE: SortCellView = Object.freeze({ colors: Object.freeze([]) });

// The mapper of the Sort screen. The view of a Sort state holds no coordinate,
// so the mapper takes no `TCoord` (issue #423). It reads each value with the helpers of
// `delivered.ts` (rule R-no-delivery-call, issue #408).
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

  // A view that delivers no data, or delivers it twice, throws an Error.
  toPayload(payload: SortView): SortPayloadView {
    return onlyValue<SortPayloadView>((keep) =>
      payload.deliverTo({
        receive: (offered, goalsDone, goalsNeeded) =>
          keep({
            offered: offered === undefined ? undefined : this.toView(offered),
            goalsDone: valueOf(goalsDone),
            goalsNeeded: valueOf(goalsNeeded),
          }),
      }),
    );
  }
}
