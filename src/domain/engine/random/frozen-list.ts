// A frozen copy of a list that holds no `undefined` (issue #419).
// A value object copies each list that it takes, so a change to the array of the caller
// does not change the value object. The copy is frozen, so no reader changes it.
// A list that holds `undefined` throws a RangeError, because `undefined` is not an item.
// A sparse list holds `undefined` in each hole, so it throws too.
// `FixedListPieceSource`, `LinesSettings`, `SortLevel` and `FitLevel` copy their lists here.
// The message names a piece list: `FixedListPieceSource` gives it too, and the tests
// of the three value objects pin it.
export function frozenListOf<T>(items: readonly T[]): readonly T[] {
  if (items.includes(undefined as T)) {
    throw new RangeError('A piece list cannot hold undefined.');
  }
  return Object.freeze([...items]);
}
