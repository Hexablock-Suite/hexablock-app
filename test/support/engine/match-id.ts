import { MatchId } from '../../../src/domain/engine/match-id';
import type { MatchIdGenerator } from '../../../src/domain/engine/match-id-generator';

// Match ids for the tests. They exist only in test/.

// One fixed id, for a test that builds one engine and compares no games.
export const MATCH_ID = MatchId.of('match-under-test');

// A generator double. It gives `match-1`, `match-2` and so on,
// so a test knows the id of each game that it starts.
export class CountingMatchIds implements MatchIdGenerator {
  private made = 0;

  next(): MatchId {
    this.made += 1;
    return MatchId.of(`match-${this.made}`);
  }
}
