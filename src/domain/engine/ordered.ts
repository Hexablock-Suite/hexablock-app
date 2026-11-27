// A value that knows its place in an order (issue #239). A value object implements it,
// such as `Distance` and `CoordKey`, so an order answers with a boolean and never with a number.
// The order is total: of two values, one comes before the other, or the two share a place.
export interface Ordered<T> {
  // Tells if this value comes before the other value.
  isBefore(other: T): boolean;
}
