import type { Cloneable } from './cloneable';

// The engine reads randomness only through this interface (rule R-domain-determinism).
// Layer 4 implements it. A test passes a seeded or a fixed source (APP-NFR-07).
// Prototype (classes.md decision 7): `clone()` copies the generator state, so a clone
// and its original give the same numbers, and neither one changes the other.
export interface RandomSource extends Cloneable<RandomSource> {
  // A number in [0, 1).
  next(): number;
}
