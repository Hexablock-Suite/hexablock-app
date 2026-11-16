import type { StateMapper } from './state-mapper';

// The cell view of the default mapper: whether a cell occupies the space.
export interface SpaceView {
  readonly occupied: boolean;
}

const FREE: SpaceView = Object.freeze({ occupied: false });
const OCCUPIED: SpaceView = Object.freeze({ occupied: true });

// The default state mapper of the game registry (classes.md decision 14, issue #170).
// It shows only whether a space is free or occupied, so it fits the board of every game.
// Each «Play … on the game screen» task (#174 to #177) registers the mapper of its variant
// in its place. The default mapper shows no payload.
export class SpaceStateMapper implements StateMapper<unknown, unknown, SpaceView, undefined> {
  toView(_cell: unknown): SpaceView {
    return OCCUPIED;
  }

  freeView(): SpaceView {
    return FREE;
  }

  toPayload(_payload: unknown): undefined {
    return undefined;
  }
}
