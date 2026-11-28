import type { GridAxis } from '../domain/engine/geometry/grid-topology';
import type { Slide } from '../domain/variants/hexa-merge/slide';
import type { Compass, SlideWay } from './merge-slide-ways';
import type { MoveMapper } from './move-mapper';

// The intent of the Merge controls: the compass name of the way that the player chose
// with a slide button, a swipe or a key.
export interface MergeIntent {
  readonly toward: Compass;
}

// The move mapper of Hexa Merge (classes.md decision 14, issue #405). It keeps the slide ways
// of the board figure, which `slideWays()` gives, and gives the `Slide` of the way that
// the intent names. Each way of a figure has its own compass name. A name that the figure
// does not have is a programming error, so it throws a RangeError.
export class MergeMoveMapper implements MoveMapper<MergeIntent, Slide<GridAxis>> {
  constructor(private readonly ways: readonly SlideWay[]) {}

  toMove({ toward }: MergeIntent): Slide<GridAxis> {
    const way = this.ways.find((candidate) => candidate.compass === toward);
    if (way === undefined) throw new RangeError('The board has no slide toward this way.');
    return way.move;
  }
}
