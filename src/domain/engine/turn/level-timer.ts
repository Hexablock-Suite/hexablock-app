import type { Clock } from './clock';
import type { ClockReading } from './clock-reading';
import { ElapsedTime } from '../../shared/elapsed-time';
import type { LevelTimerId } from './level-timer-id';
import type { ITimed } from './timed';

// Times one game with the injected `Clock` (rule R-domain-determinism, APP-NFR-07).
// `TimedRulesDecorator` starts and stops it. The timer lives outside the cloned state,
// so an undo takes a move back and the clock goes on.
// `GameEngine` pauses and resumes it, and a paused span does not count (issue #428).
// The timer is an entity inside the `GameEngine` aggregate (classes.md decisions 19 and 26).
// It changes in place, so it is not a value object. Its `LevelTimerId` is its identity.
// The id never changes, and `equals()` compares two timers by it. The readings do not count.
// The id is local: a timed variant factory builds it from the `MatchId` of the game (decision 52).
// The root keeps the timer as an optional part, as it keeps the history (classes.md decision 3).
// `GameFactory` gives the same timer to the root and to the decorator, and the root reads
// the time of play in `elapsedTime()` (issue #234).
// The timer keeps each reading of the clock as a `ClockReading` (issue #238).
export class LevelTimer implements ITimed {
  private startedAt: ClockReading | undefined;
  private stoppedAt: ClockReading | undefined;
  // The reading of the pause in progress, or `undefined` while the clock runs.
  private pausedAt: ClockReading | undefined;
  // The sum of the paused spans that ended.
  private pausedFor = ElapsedTime.ofMs(0);

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
  // A call does not end a pause: only `resume()` ends it.
  start(): void {
    this.startedAt ??= this.clock.now();
    this.stoppedAt = undefined;
  }

  // A later stop replaces an earlier one, so a retried last turn gives the real end.
  stop(): void {
    this.stoppedAt = this.clock.now();
  }

  // Keeps the reading of the pause. A timer that has not started, that has stopped
  // or that is already paused ignores the call, so a second pause starts no new span.
  pause(): void {
    if (this.startedAt === undefined || this.stoppedAt !== undefined) return;
    this.pausedAt ??= this.clock.now();
  }

  // Adds the span of the pause to the paused time. A timer with no pause ignores the call.
  resume(): void {
    if (this.pausedAt === undefined) return;
    this.pausedFor = this.pausedFor.plus(this.end().elapsedSince(this.pausedAt));
    this.pausedAt = undefined;
  }

  // The time of play as an `ElapsedTime`: a whole number of milliseconds of 0 or more.
  // `ClockReading.elapsedSince()` gives the time between the start and the stop,
  // or between the start and now while the game goes on.
  // The paused spans do not count: the ended ones and the pause in progress (issue #428).
  // A clock that goes back gives 0, and each span drops a fraction of a millisecond.
  elapsedMs(): ElapsedTime {
    if (this.startedAt === undefined) return ElapsedTime.ofMs(0);
    const end = this.end();
    const paused =
      this.pausedAt === undefined
        ? this.pausedFor
        : this.pausedFor.plus(end.elapsedSince(this.pausedAt));
    return end.elapsedSince(this.startedAt).minus(paused);
  }

  // The reading where the time of play ends: the stop, or now while the game goes on.
  private end(): ClockReading {
    return this.stoppedAt ?? this.clock.now();
  }
}
