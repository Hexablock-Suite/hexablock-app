import type { Clock } from '../domain/engine/clock';
import { MatchId } from '../domain/engine/match-id';
import type { MatchIdGenerator } from '../domain/engine/match-id-generator';

// The one id generator of the app (classes.md decisions 25 and 52, issue #162).
// It implements the engine interface `MatchIdGenerator`. Only the root of the game aggregate
// has global identity, so the composition root builds no other generator:
// `GameFactory` builds the local ids of a state, a board and a timer from the `MatchId`.
// Each id joins the clock reading at the start of the generator and a counter.
// So one generator never gives one id twice, and a later run of the app gives other ids.
export class SequentialMatchIds implements MatchIdGenerator {
  private readonly run: string;
  private made = 0;

  constructor(clock: Clock) {
    this.run = String(clock.now());
  }

  next(): MatchId {
    this.made += 1;
    return MatchId.of(`${this.run}-${this.made}`);
  }
}
