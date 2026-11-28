import type { RandomSource } from '../../../src/domain/engine/random/random-source';
import { delivered } from '../engine/value-receiver';

// The count of draws that the range test reads.
const DRAWS = 1000;

// The contract of the engine interface `RandomSource` (classes.md decision 25, issue #162).
// The engine generator `Mulberry32Random` and every adapter of the interface run the same suite.
// `make()` gives a new source for each test.
// A draw is a `RandomDraw` (issue #243). The suite reads its number through `deliverTo()`.
export function describeRandomSourceContract(name: string, make: () => RandomSource): void {
  describe(`${name} as a RandomSource`, () => {
    it('should_give_numbers_from_zero_below_one_when_the_source_draws', () => {
      const source = make();

      const numbers = Array.from({ length: DRAWS }, () => delivered(source.next()));

      expect(numbers.filter((n) => !(n >= 0 && n < 1))).toEqual([]);
    });

    // A clone that shared the generator state would move the original, so the two lists
    // would differ. Equal lists show that the clone copies the state (Prototype).
    it('should_give_the_same_numbers_as_the_original_when_a_clone_draws', () => {
      const source = make();
      source.next();
      const copy = source.clone();

      const fromCopy = [copy.next(), copy.next(), copy.next()];
      const fromSource = [source.next(), source.next(), source.next()];

      expect(fromCopy.map((draw, index) => draw.equals(fromSource[index]!))).toEqual([
        true,
        true,
        true,
      ]);
    });
  });
}
