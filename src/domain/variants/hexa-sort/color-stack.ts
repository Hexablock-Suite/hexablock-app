import type { Color } from '../../engine/color';

// The cell of Hexa Sort: a stack of colored tiles (statement §1.3).
// `chips` lists the tiles from the bottom to the top. Each tile has the engine `Color`
// (classes.md decision 5), so a tile with an empty color name cannot exist (issue #129).
// A stack is a value object: each operation returns a new stack.
// An empty stack is an empty cell. The board cannot remove a cell,
// so a cleared stack becomes an empty stack.
export class ColorStack {
  private readonly chips: readonly Color[];

  private constructor(chips: readonly Color[]) {
    this.chips = Object.freeze([...chips]);
  }

  static of(chips: readonly Color[]): ColorStack {
    return new ColorStack(chips);
  }

  static empty(): ColorStack {
    return new ColorStack([]);
  }

  // Tells how many tiles the stack holds.
  tileCount(): number {
    return this.chips.length;
  }

  isEmpty(): boolean {
    return this.chips.length === 0;
  }

  top(): Color | undefined {
    return this.chips[this.chips.length - 1];
  }

  // The tiles of the top color, from the top down to the first tile of another color.
  // Two tiles have the same color when `Color.equals()` says so, never by reference.
  topRun(): Color[] {
    const color = this.top();
    if (color === undefined) return [];
    let start = this.chips.length;
    while (start > 0 && this.chips[start - 1]?.equals(color) === true) start -= 1;
    return this.chips.slice(start);
  }

  withoutTopRun(): ColorStack {
    return new ColorStack(this.chips.slice(0, this.chips.length - this.topRun().length));
  }

  withOnTop(run: readonly Color[]): ColorStack {
    return new ColorStack([...this.chips, ...run]);
  }

  // Two stacks are equal when they hold equal colors in the same order, from the bottom up.
  equals(other: ColorStack): boolean {
    return (
      this.chips.length === other.chips.length &&
      this.chips.every((chip, i) => other.chips[i]?.equals(chip) === true)
    );
  }
}
