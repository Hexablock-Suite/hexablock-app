import type { Outcome } from '../../../src/domain/engine/outcome';
import type { Resolution } from '../../../src/domain/engine/resolution';

// Plays one turn and gives its outcome. `GameEngine.tryPlay()` is the one entry of a turn
// (classes.md decision 26, issue #415), so this helper asks it and reads `leadsTo()`.
// A rejected move gives `playing`. A test that must tell a rejected move from an accepted one
// calls `tryPlay()` and asks the resolution `wasAccepted()`.
export function playMove<TMove>(
  engine: { tryPlay(move: TMove): Resolution },
  move: NoInfer<TMove>,
): Outcome {
  return engine.tryPlay(move).leadsTo();
}
