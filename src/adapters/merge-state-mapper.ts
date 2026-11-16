import type { MergeView } from '../domain/variants/hexa-merge/merge-state';
import type { MergeTile } from '../domain/variants/hexa-merge/merge-tile';
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
// so it receives each value through `deliverTo()` (rule R-no-delivery-call).
export class MergeStateMapper implements StateMapper<
  MergeTile,
  MergeView,
  MergeCellView,
  MergePayloadView
> {
  toView(cell: MergeTile): MergeCellView {
    let value: number | undefined;
    cell.deliverTo({
      receive: (delivered) => {
        value = delivered;
      },
    });
    if (value === undefined) throw new Error('The tile delivered no value.');
    return { value };
  }

  freeView(): MergeCellView {
    return FREE;
  }

  toPayload(payload: MergeView): MergePayloadView {
    let targetReached = false;
    payload.deliverTo({
      receive: (reached) => {
        targetReached = reached;
      },
    });
    return { targetReached };
  }
}
