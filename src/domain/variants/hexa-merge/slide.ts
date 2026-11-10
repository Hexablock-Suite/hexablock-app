import type { GridAxis } from '../../engine/grid-topology';

// The way a slide goes along the line that `Board.line()` gives: toward its last
// coordinate (`forward`) or toward its first coordinate (`backward`).
// It is a value object with a closed set of two instances (classes.md decision 45, issue #207).
// Each sense has one shared instance, which is frozen. So `equals()` compares two senses
// by identity, and no code compares a text to know a sense.
// A sense orders a line from its leading edge with `fromLeadingEdge()`.
export class SlideSense {
  static readonly forward = new SlideSense('forward');
  static readonly backward = new SlideSense('backward');

  // The closed set.
  private static readonly all: readonly SlideSense[] = [SlideSense.forward, SlideSense.backward];

  private constructor(private readonly name: string) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (SlideSense.all !== undefined) throw new RangeError('The set of slide senses is closed.');
    Object.freeze(this);
  }

  // Two senses are equal when they are the same instance.
  equals(other: SlideSense): boolean {
    return this === other;
  }

  // The cells of `line` in the order of this sense: the leading edge comes first.
  // The leading edge is the edge that the tiles move toward. The line does not change.
  fromLeadingEdge<TCoord>(line: readonly TCoord[]): TCoord[] {
    return this.equals(SlideSense.forward) ? [...line].reverse() : [...line];
  }

  // The name of the sense.
  toString(): string {
    return this.name;
  }
}

export const SLIDE_SENSES: readonly SlideSense[] = [SlideSense.forward, SlideSense.backward];

// The move of Hexa Merge (§1.4): slide every tile along one direction of the topology.
// It is a value object (classes.md decision 43): it never changes, its fields are private,
// and two slides are equal when they hold the same axis and the same sense.
// The axis and the sense are value objects, so a slide compares them with their `equals()`.
// The topology gives no map from a direction name to a line,
// so a slide names an axis and a sense. A hexagon has 3 axes, so it has 6 slides.
// A slide does not know the topology, so it cannot check its own axis.
// The state asks `isAlong()` with the axes of its topology.
export class Slide<TAxis extends GridAxis> {
  private constructor(
    private readonly axis: TAxis,
    private readonly toward: SlideSense,
  ) {}

  static of<TAxis extends GridAxis>(axis: TAxis, toward: SlideSense): Slide<TAxis> {
    return new Slide(axis, toward);
  }

  // True when the axis of this slide is one of `axes`.
  isAlong(axes: readonly TAxis[]): boolean {
    return axes.some((axis) => axis.equals(this.axis));
  }

  // The line of the board on the axis of this slide that holds the cell `through`.
  lineThrough<TCoord>(
    board: { line(axis: TAxis, through: TCoord): Iterable<TCoord> },
    through: TCoord,
  ): Iterable<TCoord> {
    return board.line(this.axis, through);
  }

  // The cells of `line` in the order of this slide: the leading edge comes first.
  // The sense of the slide orders the line. The line does not change.
  fromLeadingEdge<TCoord>(line: readonly TCoord[]): TCoord[] {
    return this.toward.fromLeadingEdge(line);
  }

  // Two slides are equal when they have the same axis and the same sense.
  equals(other: Slide<TAxis>): boolean {
    return this.axis.equals(other.axis) && this.toward.equals(other.toward);
  }
}
