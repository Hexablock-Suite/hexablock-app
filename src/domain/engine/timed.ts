import type { ElapsedTime } from '../shared/elapsed-time';

// The timer capability of statement §3.2 (classes.md decisions 3, 19 and 27).
// The root keeps it as an optional part, and `GameEngine.elapsedTime()` reads it.
// So a use case asks the root and never reads a timer (issue #234).
// The root also tells it about a pause and a resume (issue #428).
// It stays apart from the undo capabilities, because a variant can time and never undo (ISP).
export interface ITimed {
  // The time of play: 0 ms before the first turn, and fixed when the game ends.
  // A paused span does not count.
  elapsedMs(): ElapsedTime;
  // Stops the clock of a running game. A timer that does not run ignores it.
  pause(): void;
  // Starts the clock again after a pause. A timer with no pause ignores it.
  resume(): void;
}
