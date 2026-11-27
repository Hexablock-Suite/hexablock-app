import type { ValueReceiver } from '../domain/shared/value-receiver';

// The one way of layer 3 to read a value of the domain (issue #408). A value object keeps its
// value private and gives it to a receiver with `deliverTo(receiver)` (rule R-no-delivery-call).
// The state mappers, the presenters and the local repositories of this layer read each value
// with `valueOf()`. A domain object that delivers several parts at once, such as the view of
// a state or a saved progress, goes through `onlyValue()`.
// A source that delivers no value, or more than one value, throws one `Error` with one message.

// A value object that delivers a value of type `T`.
export type Delivers<T> = { deliverTo(receiver: ValueReceiver<T>): void };

// The one value that `deliver` gives to `keep`. No value, or more than one value, throws.
export function onlyValue<T>(deliver: (keep: (value: T) => void) => void): T {
  const values: T[] = [];
  deliver((value) => values.push(value));
  if (values.length !== 1) {
    throw new Error(`The domain object delivered ${values.length} values, not 1.`);
  }
  return values[0];
}

// The value that a value object delivers.
export function valueOf<T>(source: Delivers<T>): T {
  return onlyValue<T>((keep) => source.deliverTo({ receive: keep }));
}

// The value of an optional value object, or `undefined` when the object is missing.
export function optionalValueOf<T>(source: Delivers<T> | undefined): T | undefined {
  return source === undefined ? undefined : valueOf(source);
}
