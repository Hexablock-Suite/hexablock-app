import { RandomDraw } from './random-draw';

// The largest state of the generator: the largest unsigned 32-bit integer.
const MAX_STATE = 0xffffffff;

// The count of states: the unsigned 32-bit integers. A draw divides a state by it.
const STATES = 4294967296;

// The step that the Mulberry32 generator adds to its state before each draw.
const INCREMENT = 0x6d2b79f5;

// The state of the Mulberry32 generator: a whole number from 0 to 4294967295
// (classes.md decision 48, issue #243). It is a value object: it never changes.
// `of()` is the only place that checks the number. A negative zero is stored as 0.
// The number stays private. The Mulberry32 arithmetic works on it here:
// `advanced()` gives the next state, and `draw()` gives the draw of a state.
// It uses pure 32-bit integer arithmetic, so the same state always gives the same draw.
export class GeneratorState {
  private constructor(private readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): GeneratorState {
    if (!Number.isInteger(value) || value < 0 || value > MAX_STATE) {
      throw new RangeError(
        `A generator state must be an integer from 0 to 4294967295, not ${value}.`,
      );
    }
    return new GeneratorState(value >>> 0);
  }

  // Two states are equal when they hold the same number.
  equals(other: GeneratorState): boolean {
    return this.value === other.value;
  }

  // The next state: this state plus the Mulberry32 step, modulo 2 to the power of 32.
  advanced(): GeneratorState {
    return new GeneratorState((this.value + INCREMENT) >>> 0);
  }

  // The draw of this state: the Mulberry32 mix of the state, divided by the count of states.
  draw(): RandomDraw {
    let t = this.value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return RandomDraw.of(((t ^ (t >>> 14)) >>> 0) / STATES);
  }
}
