// The color of one Sort tile. Decision 5 of classes.md puts `Color` in the engine.
// The engine has no `Color` yet, so the variant names its own color type.
export type Color = string;

// The cell of Hexa Sort: a stack of colored tiles (statement §1.3).
// `chips` lists the tiles from the bottom to the top.
// A stack is a value object: each operation returns a new stack.
// An empty stack is an empty cell. The board cannot remove a cell,
// so a cleared stack becomes an empty stack.
export class ColorStack {
  readonly chips: readonly Color[];

  private constructor(chips: readonly Color[]) {
    this.chips = Object.freeze([...chips]);
  }

  static of(chips: readonly Color[]): ColorStack {
    return new ColorStack(chips);
  }

  static empty(): ColorStack {
    return new ColorStack([]);
  }

  get size(): number {
    return this.chips.length;
  }

  isEmpty(): boolean {
    return this.chips.length === 0;
  }

  top(): Color | undefined {
    return this.chips[this.chips.length - 1];
  }

  // The tiles of the top color, from the top down to the first tile of another color.
  topRun(): Color[] {
    const color = this.top();
    let start = this.chips.length;
    while (start > 0 && this.chips[start - 1] === color) start -= 1;
    return this.chips.slice(start);
  }

  withoutTopRun(): ColorStack {
    return new ColorStack(this.chips.slice(0, this.chips.length - this.topRun().length));
  }

  withOnTop(run: readonly Color[]): ColorStack {
    return new ColorStack([...this.chips, ...run]);
  }
}
