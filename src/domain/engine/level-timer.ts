import type { Clock } from './clock';
import type { ITimed } from './timed';

// Times one game with the injected `Clock` (rule R-domain-determinism, APP-NFR-07).
// `TimedRulesDecorator` starts and stops it. The timer lives outside the cloned state,
// so an undo takes a move back and the clock goes on.
export class LevelTimer implements ITimed {
  private startedAt: number | undefined;
  private stoppedAt: number | undefined;

  constructor(private readonly clock: Clock) {}

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

  // A clock that goes back gives 0: `GameResult.of()` and `fitStars()` reject a negative time.
  elapsedMs(): number {
    if (this.startedAt === undefined) return 0;
    return Math.max(0, (this.stoppedAt ?? this.clock.now()) - this.startedAt);
  }
}
