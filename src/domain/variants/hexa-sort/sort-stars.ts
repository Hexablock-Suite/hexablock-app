// The threshold of one Sort star (D22, the accepted rule of issue #59): a move count.
// The level file holds the thresholds, as it does for Fit (D20).
export interface SortStarThreshold {
  readonly maxMoves: number;
}

// The moves of one won Sort level. The caller counts the moves.
export interface SortPlay {
  readonly moves: number;
}

// The stars of a won Sort level, by moves (D22, the accepted rule of issue #59).
// A star needs `moves <= maxMoves`. The stars are cumulative: star N needs star N-1.
// So the count is the number of leading thresholds that the play meets.
// `fitStars` counts the same way. This function does not check its input.
export function sortStars(play: SortPlay, thresholds: readonly SortStarThreshold[]): number {
  const missed = thresholds.findIndex((t) => play.moves > t.maxMoves);
  return missed < 0 ? thresholds.length : missed;
}
