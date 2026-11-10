import type { PieceId } from './piece-id';

// The entries of one Fit game by piece id: its pieces, or its placements (classes.md decision 49).
// It is a domain collection, and it is a value object: it never changes.
// `with()` and `without()` return a new register, and `FitState` keeps the new one.
// It finds an entry with `PieceId.equals()`, so an equal id that is another object finds
// the same entry. No text of an id is a key.
// It keeps the order of the first record of each id.
// An id that the register holds keeps its place when it takes a new entry.
// An id that left the register goes to the end when it comes back.
// The list and its pairs are frozen, so no caller writes them.
export class PieceRegister<TEntry> {
  private constructor(private readonly kept: readonly (readonly [PieceId, TEntry])[]) {
    Object.freeze(this);
  }

  static empty<TEntry>(): PieceRegister<TEntry> {
    return new PieceRegister<TEntry>(Object.freeze([]));
  }

  // The entry of the id, or `undefined` when the register does not hold the id.
  find(id: PieceId): TEntry | undefined {
    return this.kept.find(([held]) => held.equals(id))?.[1];
  }

  has(id: PieceId): boolean {
    return this.kept.some(([held]) => held.equals(id));
  }

  // A register that also holds the entry under the id. This register does not change.
  // An equal id that this register holds keeps its place, with the new id object and the new entry.
  with(id: PieceId, entry: TEntry): PieceRegister<TEntry> {
    const pair = Object.freeze([id, entry] as const);
    const next = this.has(id)
      ? this.kept.map((held) => (held[0].equals(id) ? pair : held))
      : [...this.kept, pair];
    return new PieceRegister<TEntry>(Object.freeze(next));
  }

  // A register without the entry of the id. This register does not change.
  // An id that this register does not hold gives an equal register.
  without(id: PieceId): PieceRegister<TEntry> {
    return new PieceRegister<TEntry>(Object.freeze(this.kept.filter(([held]) => !held.equals(id))));
  }

  // The ids and their entries as new pairs, in the order of the register.
  // A caller cannot change the register through the list or through a pair.
  entries(): [PieceId, TEntry][] {
    return this.kept.map(([id, entry]) => [id, entry]);
  }

  // Two registers are equal when they hold equal ids in the same order with equal entries.
  // `sameEntry` compares two entries, because `TEntry` has no `equals`.
  equals(
    other: PieceRegister<TEntry>,
    sameEntry: (left: TEntry, right: TEntry) => boolean,
  ): boolean {
    return (
      this.kept.length === other.kept.length &&
      this.kept.every(([id, entry], index) => {
        const theirs = other.kept[index];
        return theirs !== undefined && id.equals(theirs[0]) && sameEntry(entry, theirs[1]);
      })
    );
  }
}
