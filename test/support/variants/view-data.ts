import type { Color } from '../../../src/domain/engine/color';
import type { Moves } from '../../../src/domain/shared/moves';
import type { Piece } from '../../../src/domain/engine/piece';
import { FitView } from '../../../src/domain/variants/hexa-fit/fit-state';
import type { PieceId } from '../../../src/domain/variants/hexa-fit/piece-id';
import { LinesView } from '../../../src/domain/variants/hexa-lines/lines-state';
import { MergeView } from '../../../src/domain/variants/hexa-merge/merge-state';
import type { ClearedStacks } from '../../../src/domain/variants/hexa-sort/cleared-stacks';
import type { GoalCount } from '../../../src/domain/variants/hexa-sort/goal-count';
import { SortView, type SortTray } from '../../../src/domain/variants/hexa-sort/sort-state';

// Reads the view of each variant as an adapter of the edge does. It exists only in test/.
// A view keeps its fields private and delivers its data to a receiver (issue #245).
// Each function gives the data of one delivery as a plain record, named as the screen names it.

// The data of the one delivery that `deliver` makes. A view that delivers its data no time,
// or more than one time, throws.
function once<T>(deliver: (keep: (data: T) => void) => void): T {
  const kept: T[] = [];
  deliver((data) => {
    kept.push(data);
  });
  if (kept.length !== 1) {
    throw new Error(`The view delivered its data ${kept.length} times, not 1.`);
  }
  return kept[0];
}

// The tray that a Lines view delivers.
export function linesViewData<TCoord>(view: LinesView<TCoord>): {
  readonly tray: readonly Piece<Color, TCoord>[];
} {
  return once((keep) => view.deliverTo({ receive: (tray) => keep({ tray }) }));
}

// The tray, the placed pieces and the move count that a Fit view delivers.
export function fitViewData<TCoord>(view: FitView<TCoord>): {
  readonly remaining: readonly Piece<PieceId, TCoord>[];
  readonly placed: readonly PieceId[];
  readonly moves: Moves;
} {
  return once((keep) =>
    view.deliverTo({
      receive: (remaining, placed, moves) => keep({ remaining, placed, moves }),
    }),
  );
}

// The slots of the tray and the two goal counts that a Sort view delivers (issue #353).
export function sortViewData(view: SortView): {
  readonly tray: SortTray;
  readonly goalsDone: ClearedStacks;
  readonly goalsNeeded: GoalCount;
} {
  return once((keep) =>
    view.deliverTo({
      receive: (tray, goalsDone, goalsNeeded) => keep({ tray, goalsDone, goalsNeeded }),
    }),
  );
}

// Whether the target tile exists, as a Merge view delivers it.
export function mergeViewData(view: MergeView): { readonly targetReached: boolean } {
  return once((keep) => view.deliverTo({ receive: (targetReached) => keep({ targetReached }) }));
}

// The data of the view of any variant, for a test that names no variant.
// A test may ask the class of a view. Production code never does.
// Any other value, such as the plain view of the fake game, comes back as it is.
export function viewData(view: unknown): unknown {
  if (view instanceof LinesView) return linesViewData(view);
  if (view instanceof FitView) return fitViewData(view);
  if (view instanceof SortView) return sortViewData(view);
  if (view instanceof MergeView) return mergeViewData(view);
  return view;
}
