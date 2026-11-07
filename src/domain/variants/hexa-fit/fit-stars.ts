import { Range } from '../../engine/range';

// The two thresholds of one Fit star (statement §1.2, D20): a move count and a time.
// The level file holds them, and `FitLevelBuilder` reads them (classes.md decision 36).
export interface FitStarThreshold {
  readonly maxMoves: number;
  readonly maxElapsedMs: number;
}

// The moves and the elapsed time of one won Fit level.
// `FitState.moves` counts the moves: every accepted place, rotate and remove (issue #60).
export interface FitPlay {
  readonly moves: number;
  readonly elapsedMs: number;
}

// A move count is a safe integer of 0 or more (gap G110.1).
const MOVES = Range.ofNumbers(0, Number.MAX_SAFE_INTEGER);
// A time is a finite number of 0 or more, in milliseconds (gap G110.2).
const ELAPSED_MS = Range.ofNumbers(0, Number.MAX_VALUE);

// The stars of a won Fit level. The accepted rule of issue #59 (D22, 2026-11-06):
// a star needs both of its thresholds, the moves and the time.
// The stars are cumulative: star N needs star N-1 (gap G110.5), as for `sortStars`.
// So the count is the number of leading thresholds that the play meets.
// A move count or a time that no play gives throws a RangeError. -0 counts as 0.
export function fitStars(play: FitPlay, thresholds: readonly FitStarThreshold[]): number {
  const { moves, elapsedMs } = play;
  if (!Number.isSafeInteger(moves) || !MOVES.contains(moves)) {
    throw new RangeError(`A move count needs a whole number of 0 or more, not ${moves}.`);
  }
  if (!ELAPSED_MS.contains(elapsedMs)) {
    throw new RangeError(`An elapsed time needs a finite number of 0 or more, not ${elapsedMs}.`);
  }
  const missed = thresholds.findIndex((t) => moves > t.maxMoves || elapsedMs > t.maxElapsedMs);
  return missed < 0 ? thresholds.length : missed;
}
