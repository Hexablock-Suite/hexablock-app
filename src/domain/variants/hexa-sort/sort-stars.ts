import type { Moves } from '../../engine/moves';
import { Stars } from '../../engine/stars';

// The moves of one won Sort level. The caller counts the moves.
// It is a value object (classes.md decision 42): it never changes, and two plays are equal
// when their moves are equal. `Moves` checks its own value, so a play holds no count
// that a game cannot give (issue #137).
export class SortPlay {
  private constructor(readonly moves: Moves) {
    Object.freeze(this);
  }

  static of(moves: Moves): SortPlay {
    return new SortPlay(moves);
  }

  // Two plays are equal when their moves are equal.
  equals(other: SortPlay): boolean {
    return this.moves.equals(other.moves);
  }
}

// The threshold of one Sort star (D22, the accepted rule of issue #59): a move count.
// The level file holds the thresholds, as it does for Fit (D20).
// It is a value object (classes.md decision 42): it never changes, and two thresholds are
// equal when their limits are equal. The limit stays private: `isMetBy()` compares a play.
// The order of the thresholds of a level is not checked here:
// that check belongs to the level builders, which read the level file (issue #49).
export class SortStarThreshold {
  private constructor(private readonly maxMoves: Moves) {
    Object.freeze(this);
  }

  static of(maxMoves: Moves): SortStarThreshold {
    return new SortStarThreshold(maxMoves);
  }

  // Two thresholds are equal when their limits are equal.
  equals(other: SortStarThreshold): boolean {
    return this.maxMoves.equals(other.maxMoves);
  }

  // Tells if a play meets the threshold: its moves are the limit or fewer.
  isMetBy(play: SortPlay): boolean {
    return !this.maxMoves.isFewerThan(play.moves);
  }
}

// The stars of a won Sort level, by moves, as a `Stars` value object
// (D22, the accepted rule of issue #59).
// The stars are cumulative: star N needs star N-1.
// So the count is the number of leading thresholds that the play meets.
// `fitStars` counts the same way.
export function sortStars(play: SortPlay, thresholds: readonly SortStarThreshold[]): Stars {
  const missed = thresholds.findIndex((threshold) => !threshold.isMetBy(play));
  return Stars.of(missed < 0 ? thresholds.length : missed);
}
