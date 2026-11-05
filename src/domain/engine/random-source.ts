// The engine reads randomness only through this interface (rule R-domain-determinism).
// Layer 4 implements it. A test passes a seeded or a fixed source (APP-NFR-07).
export interface RandomSource {
  // A number in [0, 1).
  next(): number;
}
