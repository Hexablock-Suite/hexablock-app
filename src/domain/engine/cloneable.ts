// Prototype (statement §3.3, D3). `clone()` takes the snapshot for undo and for the piece preview.
export interface Cloneable<T> {
  clone(): T;
}
