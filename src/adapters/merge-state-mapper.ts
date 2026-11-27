import type { MergeView } from '../domain/variants/hexa-merge/merge-state';
import type { MergeTile } from '../domain/variants/hexa-merge/merge-tile';
import { valueOf } from './delivered';
import type { StateMapper } from './state-mapper';

// The cell view of the Merge screen: the number of the tile on the space.
// A free space has no number.
export interface MergeCellView {
  readonly value?: number;
}

// The payload view of the Merge screen: whether a merge of the game has made the target tile.
// The flag stays true after the first time (A3).
export interface MergePayloadView {
  readonly targetReached: boolean;
}

const FREE: MergeCellView = Object.freeze({});

// The state mapper of Hexa Merge (classes.md decision 14, issue #177). The game registry pairs it
// with `MergeCellRenderer`. It repeats no rule: the tile delivers its number, and the view
// of the payload delivers the target flag that the state computed. It is an adapter of the edge,
// so it receives each value with `valueOf()` of `delivered.ts`, which calls `deliverTo()`
// (rule R-no-delivery-call, issue #408).
export class MergeStateMapper implements StateMapper<
  MergeTile,
  MergeView,
  MergeCellView,
  MergePayloadView
> {
  toView(cell: MergeTile): MergeCellView {
    return { value: valueOf(cell) };
  }

  freeView(): MergeCellView {
    return FREE;
  }

  toPayload(payload: MergeView): MergePayloadView {
    return { targetReached: valueOf(payload) };
  }
}
