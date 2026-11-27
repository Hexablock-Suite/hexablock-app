// Prototype (statement §3.3). `clone()` gives a copy that changes apart from the original.
// The engine plays each turn on a clone of the state, and each photo holds a clone of the board.
// `SeededPieceSource` clones its `RandomSource` before a draw.
export interface Cloneable<T> {
  clone(): T;
}
