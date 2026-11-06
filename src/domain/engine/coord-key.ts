declare const coordKeyBrand: unique symbol;

// The key of one coordinate: the text that a topology gives in `key()`.
// The brand stops a free string from standing in for a key.
// A Map and a Set compare a string by value and an object by reference,
// so the key stays a string and is not a class.
export type CoordKey = string & { readonly [coordKeyBrand]: true };

// Brands a text as a key. A topology calls it in `key()`.
// It brands any text and checks no format. The topology owns the format of its keys,
// and it must give one key to each coordinate and two keys to two coordinates.
// This is a design choice: the engine cannot know the format of every topology.
export function coordKey(text: string): CoordKey {
  return text as CoordKey;
}
