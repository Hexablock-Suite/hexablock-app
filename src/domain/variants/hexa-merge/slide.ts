// The way a slide goes along the line that `Board.line()` gives: toward its last
// coordinate (`forward`) or toward its first coordinate (`backward`).
export type SlideSense = 'forward' | 'backward';

export const SLIDE_SENSES: readonly SlideSense[] = ['forward', 'backward'];

// The move of Hexa Merge (§1.4): slide every tile along one direction of the topology.
// It is a value object. The topology gives no map from a direction name to a line,
// so a slide names an axis and a sense. A hexagon has 3 axes, so it has 6 slides.
export class Slide<TAxis extends string> {
  private constructor(
    readonly axis: TAxis,
    readonly toward: SlideSense,
  ) {}

  static of<TAxis extends string>(axis: TAxis, toward: SlideSense): Slide<TAxis> {
    return new Slide(axis, toward);
  }
}
