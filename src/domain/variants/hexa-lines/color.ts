// The content of one Hexa Lines cell (statement §1.5). It is a value object: it never changes.
// Classes.md decision 5 puts `Color` in the engine, because Hexa Sort uses it too.
// No engine `Color` exists yet, so Hexa Lines keeps its own until the engine adds one.
export class Color {
  private constructor(readonly name: string) {}

  static of(name: string): Color {
    if (name.trim() === '') throw new RangeError('A color needs a name.');
    return new Color(name);
  }
}
