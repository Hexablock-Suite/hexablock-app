// The fields of one JSON object of a level file, by name (DS-6, issue #424).
// A level builder gets the section of a level file as `unknown`, so it checks each object
// at runtime before it reads a field. `FitLevelBuilder` and `SortLevelBuilder` share it.
// `names` lists the fields that the object must hold. Each field stays `unknown`,
// so the builder checks each value that it reads.
// Any other value throws the error that `refusal` builds, and the value is its `cause`
// (issue #237). The names are keys of the parsed object, so the result names exactly these keys.
export function fieldsOf<const TName extends PropertyKey>(
  value: unknown,
  names: readonly TName[],
  refusal: (cause: unknown) => RangeError,
): Readonly<Record<TName, unknown>> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !names.every((name) => name in value)
  ) {
    throw refusal(value);
  }
  return value as Readonly<Record<TName, unknown>>;
}
