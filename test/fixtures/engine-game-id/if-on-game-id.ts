// Wrong example for test/gates/engine-game-id-gate.test.ts: an `if` on the game id.
import { GameId } from '../../../src/domain/engine/game-id';

export function bonus(gameId: GameId): number {
  if (gameId.equals(GameId.of('hexa-lines'))) return 10;
  return 0;
}
