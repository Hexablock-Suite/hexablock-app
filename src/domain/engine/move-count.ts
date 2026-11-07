import { Range } from './range';

// A move count is a safe integer of 0 or more (gap G110.1).
const MOVE_COUNTS = Range.ofNumbers(0, Number.MAX_SAFE_INTEGER);

// Checks the move count of one play. `fitStars` and `sortStars` call it before they
// compare the count with the thresholds (issue #137). NaN fails every comparison,
// so an unchecked NaN wins every star. A count that no play gives throws a RangeError.
// -0 counts as 0.
export function checkMoveCount(moves: number): void {
  if (!Number.isSafeInteger(moves) || !MOVE_COUNTS.contains(moves)) {
    throw new RangeError(`A move count needs a whole number of 0 or more, not ${moves}.`);
  }
}
