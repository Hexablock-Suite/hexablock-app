import type { ElapsedTime } from './elapsed-time';

// The timer capability of statement §3.2 (classes.md decisions 3, 19 and 27).
// The root keeps it as an optional part, and `GameEngine.elapsedTime()` reads it.
// So a use case asks the root and never reads a timer (issue #234).
// It stays apart from the undo capabilities, because a variant can time and never undo (ISP).
export interface ITimed {
  // The time of play: 0 ms before the first turn, and fixed when the game ends.
  elapsedMs(): ElapsedTime;
}
