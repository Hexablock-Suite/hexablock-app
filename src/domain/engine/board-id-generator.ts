import type { BoardId } from './board-id';

// The engine takes the id of a new board only through this interface (rule R-domain-determinism).
// Layer 4 implements it. It is an engine interface, not a port (classes.md decision 25).
export interface BoardIdGenerator {
  // A new id on each call. Two calls never give equal ids.
  next(): BoardId;
}
