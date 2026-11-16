import type { Cloneable } from './cloneable';
import type { RandomDraw } from './random-draw';

// The engine reads randomness only through this interface (rule R-domain-determinism).
// Layer 4 implements it. A test passes a seeded or a fixed source (APP-NFR-07).
// Prototype (classes.md decision 7): `clone()` copies the generator state, so a clone
// and its original give the same draws, and neither one changes the other.
export interface RandomSource extends Cloneable<RandomSource> {
  // The next draw: a `RandomDraw`, a number from 0 up to 1 that stays private (issue #243).
  next(): RandomDraw;
}
