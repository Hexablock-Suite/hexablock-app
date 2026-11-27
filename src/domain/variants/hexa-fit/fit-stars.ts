import type { ElapsedTime } from '../../shared/elapsed-time';
import type { Moves } from '../../shared/moves';
import type { IStarThreshold } from '../../progress/star-count';

// The moves and the elapsed time of one won Fit level.
// `FitState` counts the moves: every accepted place, rotate and remove (issue #60).
// It is a value object (classes.md decision 42): it never changes, and two plays are equal
// when their moves and their times are equal. `Moves` and `ElapsedTime` check their own values,
// so a play holds no count and no time that a game cannot give (gaps G110.1 and G110.2).
// Both fields are private (issue #240). A threshold gives its limits to `isWithin()`.
export class FitPlay {
  private constructor(
    private readonly moves: Moves,
    private readonly elapsedMs: ElapsedTime,
  ) {
    Object.freeze(this);
  }

  static of(values: { moves: Moves; elapsedMs: ElapsedTime }): FitPlay {
    return new FitPlay(values.moves, values.elapsedMs);
  }

  // Two plays are equal when their moves and their times are equal.
  equals(other: FitPlay): boolean {
    return this.moves.equals(other.moves) && this.elapsedMs.equals(other.elapsedMs);
  }

  // Tells if the play stays within both limits: its moves and its time.
  // A play that equals a limit stays within it.
  isWithin(maxMoves: Moves, maxElapsedMs: ElapsedTime): boolean {
    return !maxMoves.isFewerThan(this.moves) && !maxElapsedMs.isShorterThan(this.elapsedMs);
  }
}

// The two thresholds of one Fit star (statement §1.2, D20): a move count and a time.
// The level file holds them, and `FitLevelBuilder` reads them (classes.md decision 36).
// It is a value object (classes.md decision 42): it never changes, and two thresholds are
// equal when their limits are equal. The limits stay private: `isMetBy()` compares a play.
// `starsOf()` counts the stars of a play with these thresholds (issue #424).
export class FitStarThreshold implements IStarThreshold<FitPlay> {
  private constructor(
    private readonly maxMoves: Moves,
    private readonly maxElapsedMs: ElapsedTime,
  ) {
    Object.freeze(this);
  }

  static of(values: { maxMoves: Moves; maxElapsedMs: ElapsedTime }): FitStarThreshold {
    return new FitStarThreshold(values.maxMoves, values.maxElapsedMs);
  }

  // Two thresholds are equal when their two limits are equal.
  equals(other: FitStarThreshold): boolean {
    return this.maxMoves.equals(other.maxMoves) && this.maxElapsedMs.equals(other.maxElapsedMs);
  }

  // Tells if a play meets the threshold. The accepted rule of issue #59 (D22, 2026-11-06):
  // a star needs both limits, the moves and the time. A play that equals a limit meets it.
  // The threshold gives its limits to the play, and the play answers.
  isMetBy(play: FitPlay): boolean {
    return play.isWithin(this.maxMoves, this.maxElapsedMs);
  }
}
