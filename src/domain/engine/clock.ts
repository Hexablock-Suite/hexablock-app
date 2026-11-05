// The engine reads time only through this interface (rule R-domain-determinism).
// Layer 4 implements it. It is an engine interface, not a port (classes.md decision 25).
export interface Clock {
  // Milliseconds since an origin that the implementation chooses.
  now(): number;
}
