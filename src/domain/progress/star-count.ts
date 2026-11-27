import { Stars } from './stars';

// The threshold of one star of a level (D22, classes.md decision 36): a play meets it or not.
// Each variant with levels has its own play and its own threshold: Fit counts by moves and time,
// and Sort counts by moves. So the threshold names the type of the play, and the engine
// names no variant.
export interface IStarThreshold<TPlay> {
  isMetBy(play: TPlay): boolean;
}

// The stars of a won play of a level, as a `Stars` value object (D22, issue #424).
// The stars are cumulative: star N needs star N-1 (gap G110.5).
// So the count is the number of leading thresholds that the play meets.
// Fit and Sort count their stars with this one function, and only their play
// and their threshold differ. A level with no threshold gives 0 stars.
export function starsOf<TPlay>(play: TPlay, thresholds: readonly IStarThreshold<TPlay>[]): Stars {
  const missed = thresholds.findIndex((threshold) => !threshold.isMetBy(play));
  return Stars.of(missed < 0 ? thresholds.length : missed);
}
