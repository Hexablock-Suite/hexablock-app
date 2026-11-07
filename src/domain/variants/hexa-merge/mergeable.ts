// The bound of the Merge rules (statement §3.1, classes.md decision 8, APP-NFR-05).
// The rules need only one capability from a cell: it merges with an equal cell.
// `T` is the cell type itself, so a merge gives a cell of the same type.
export interface IMergeable<T> {
  // True when the two cells can merge, that is when they are equal (§1.4).
  canMergeWith(other: T): boolean;
  // The cell that the two cells make. It throws a RangeError when `canMergeWith()` is false.
  mergeWith(other: T): T;
}
