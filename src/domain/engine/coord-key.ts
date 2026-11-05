declare const coordKeyBrand: unique symbol;

// The key of one coordinate: the text that a topology gives in `key()`.
// The brand stops a free string from standing in for a key.
// A Map and a Set compare a string by value and an object by reference,
// so the key stays a string and is not a class.
export type CoordKey = string & { readonly [coordKeyBrand]: true };

// Brands a text as a key. A topology calls it in `key()`.
export function coordKey(text: string): CoordKey {
  return text as CoordKey;
}
