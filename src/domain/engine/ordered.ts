// A value that knows its place in an order (issue #239). A value object implements it,
// so a `Range<T>` orders its bounds with a boolean and never with a number.
// The order is total: of two values, one comes before the other, or the two share a place.
export interface Ordered<T> {
  // Tells if this value comes before the other value.
  isBefore(other: T): boolean;
}
