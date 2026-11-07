// The color of one cell or one tile (statement §1.5). Hexa Lines fills a cell with a color,
// and a Hexa Sort stack holds a list of colors. Classes.md decision 5 puts `Color` in the engine,
// because rule `variants-isolated` forbids one variant from importing another (issue #129).
// It is a value object: it never changes. `of()` rejects an empty or blank name.
// `of()` makes a new object on each call, so a caller compares two colors with `equals()`.
export class Color {
  private constructor(readonly name: string) {}

  static of(name: string): Color {
    if (name.trim() === '') throw new RangeError('A color needs a name.');
    return new Color(name);
  }

  // Two colors are equal when they have the same name. The names compare as written.
  equals(other: Color): boolean {
    return this.name === other.name;
  }
}
