import type { Clock } from './clock';
import { ElapsedTime } from './elapsed-time';
import type { LevelTimerId } from './level-timer-id';
import type { ITimed } from './timed';

// Times one game with the injected `Clock` (rule R-domain-determinism, APP-NFR-07).
// `TimedRulesDecorator` starts and stops it. The timer lives outside the cloned state,
// so an undo takes a move back and the clock goes on.
// The timer is an entity inside the `GameEngine` aggregate (classes.md decisions 19 and 26).
// It changes in place, so it is not a value object. Its `LevelTimerId` is its identity.
// The id never changes, and `equals()` compares two timers by it. The readings do not count.
// A `LevelTimerIdGenerator` gives the id of each new timer.
// The root keeps no field for the timer: it reaches the timer through `IGameRules.timed()`.
export class LevelTimer implements ITimed {
  private startedAt: number | undefined;
  private stoppedAt: number | undefined;

  constructor(
    private readonly identity: LevelTimerId,
    private readonly clock: Clock,
  ) {}

  // Two timers with one id are the same timer. Their clocks and their readings do not count.
  equals(other: LevelTimer): boolean {
    return this.identity.equals(other.identity);
  }

  // Only the first call reads the clock. Each call clears a stop,
  // because the engine can roll back a last turn, and then the game goes on.
  start(): void {
    this.startedAt ??= this.clock.now();
    this.stoppedAt = undefined;
  }

  // A later stop replaces an earlier one, so a retried last turn gives the real end.
  stop(): void {
    this.stoppedAt = this.clock.now();
  }

  // The time of play as an `ElapsedTime`: a whole number of milliseconds of 0 or more.
  // A clock that goes back gives 0, because an `ElapsedTime` is never negative.
  // A clock can give a fraction of a millisecond, and the timer drops that fraction.
  elapsedMs(): ElapsedTime {
    if (this.startedAt === undefined) return ElapsedTime.ofMs(0);
    const passed = (this.stoppedAt ?? this.clock.now()) - this.startedAt;
    return ElapsedTime.ofMs(Math.max(0, Math.floor(passed)));
  }
}
