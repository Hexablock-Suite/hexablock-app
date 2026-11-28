import type { CoordKey } from './coord-key';

// A list of values, each under the key of one coordinate (issue #246).
// A `Map` compares an object key by reference. A `CoordKey` is a value object, and each
// call of `key()` gives a new object. So this map compares the keys with `equals()`.
// It keeps the order of the first write, as a `Map` does: a key that is set again keeps
// its place, and a deleted key goes to the end when it is set again.
// The scan is linear. A board holds less than one hundred cells, so a scan is fast enough,
// and no code reads the text of a key to index it (classes.md decision 44).
export class CoordKeyMap<TValue> {
  private readonly pairs: { readonly key: CoordKey; readonly value: TValue }[] = [];

  // True when the map holds a value under a key equal to `key`.
  has(key: CoordKey): boolean {
    return this.indexOf(key) >= 0;
  }

  // The value under a key equal to `key`, or `undefined` when the map holds none.
  find(key: CoordKey): TValue | undefined {
    return this.pairs[this.indexOf(key)]?.value;
  }

  // Puts the value under the key. An equal key keeps its place and takes the new value.
  set(key: CoordKey, value: TValue): void {
    const at = this.indexOf(key);
    if (at < 0) this.pairs.push({ key, value });
    else this.pairs.splice(at, 1, { key, value });
  }

  // Removes the value under a key equal to `key`. A key that the map lacks changes nothing.
  delete(key: CoordKey): void {
    const at = this.indexOf(key);
    if (at >= 0) this.pairs.splice(at, 1);
  }

  // Every value, in the order of the first write, as a new list.
  values(): TValue[] {
    return this.pairs.map((entry) => entry.value);
  }

  // Every key with its value, in the order of the first write, as new pairs.
  entries(): [CoordKey, TValue][] {
    return this.pairs.map((entry) => [entry.key, entry.value]);
  }

  private indexOf(key: CoordKey): number {
    return this.pairs.findIndex((entry) => entry.key.equals(key));
  }
}
