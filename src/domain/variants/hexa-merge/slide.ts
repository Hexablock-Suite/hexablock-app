// The way a slide goes along the line that `Board.line()` gives: toward its last
// coordinate (`forward`) or toward its first coordinate (`backward`).
export type SlideSense = 'forward' | 'backward';

export const SLIDE_SENSES: readonly SlideSense[] = ['forward', 'backward'];

// The move of Hexa Merge (§1.4): slide every tile along one direction of the topology.
// It is a value object (classes.md decision 43): it never changes, its fields are private,
// and two slides are equal when they hold the same axis and the same sense.
// The topology gives no map from a direction name to a line,
// so a slide names an axis and a sense. A hexagon has 3 axes, so it has 6 slides.
// A slide does not know the topology, so it cannot check its own axis.
// The state asks `isAlong()` with the axes of its topology.
export class Slide<TAxis extends string> {
  private constructor(
    private readonly axis: TAxis,
    private readonly toward: SlideSense,
  ) {}

  static of<TAxis extends string>(axis: TAxis, toward: SlideSense): Slide<TAxis> {
    return new Slide(axis, toward);
  }

  // True when the axis of this slide is one of `axes`.
  isAlong(axes: readonly TAxis[]): boolean {
    return axes.includes(this.axis);
  }

  // The line of the board on the axis of this slide that holds the cell `through`.
  lineThrough<TCoord>(
    board: { line(axis: TAxis, through: TCoord): Iterable<TCoord> },
    through: TCoord,
  ): Iterable<TCoord> {
    return board.line(this.axis, through);
  }

  // The cells of `line` in the order of this slide: the leading edge comes first.
  // The leading edge is the edge that the tiles move toward. The line does not change.
  fromLeadingEdge<TCoord>(line: readonly TCoord[]): TCoord[] {
    return this.toward === 'forward' ? [...line].reverse() : [...line];
  }

  // Two slides are equal when they have the same axis and the same sense.
  equals(other: Slide<TAxis>): boolean {
    return this.axis === other.axis && this.toward === other.toward;
  }
}
