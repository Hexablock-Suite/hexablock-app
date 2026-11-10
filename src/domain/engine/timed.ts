// The timer capability of statement §3.2 (classes.md decisions 3, 19 and 27).
// `GameEngine.timed()` returns it, so a use case never reads a timer class.
// It stays apart from the undo capabilities, because a variant can time and never undo (ISP).
export interface ITimed {
  // The milliseconds of play: 0 before the first turn, and fixed when the game ends.
  elapsedMs(): number;
}
