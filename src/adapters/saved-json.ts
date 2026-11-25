import type { ValueReceiver } from '../domain/engine/value-receiver';

// The helpers of the local repositories that save a domain object as JSON (issues #164
// and #363). A repository reads each value of the domain with `deliverTo(receiver)`, and it
// checks each part of a parsed JSON text before a factory method of the domain checks the value.
// A part of the wrong type throws a `RangeError` with the message that the repository gives.

// A value object that delivers a value of type `T`.
export type Delivers<T> = { deliverTo(receiver: ValueReceiver<T>): void };

// A parsed JSON object.
export type JsonObject = Readonly<Record<string, unknown>>;

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

// `make(value)`, or `undefined` when the value is missing.
export function optionalOf<T, R>(value: T | undefined, make: (value: T) => R): R | undefined {
  return value === undefined ? undefined : make(value);
}

// Tells if `data` is a JSON object: not `null` and not a list.
export function isObject(data: unknown): data is JsonObject {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

// The number of the field `name`. A missing field or a value of another type throws
// a `RangeError` with the message `invalid`.
export function numberIn(data: JsonObject, name: string, invalid: string): number {
  const value = data[name];
  if (typeof value !== 'number') throw new RangeError(invalid);
  return value;
}

// The number of the field `name`, or `undefined` when the field is missing.
export function optionalNumberIn(
  data: JsonObject,
  name: string,
  invalid: string,
): number | undefined {
  return data[name] === undefined ? undefined : numberIn(data, name, invalid);
}

// The text of the field `name`, or `undefined` when the field is missing.
// A value of another type throws a `RangeError` with the message `invalid`.
export function optionalTextIn(
  data: JsonObject,
  name: string,
  invalid: string,
): string | undefined {
  const value = data[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new RangeError(invalid);
  return value;
}
