import type { GameId } from '../domain/engine/game-id';
import type { GameProgress } from '../domain/engine/game-progress';

// Output port and repository of the progress aggregate (classes.md decisions 52, 54 and 55,
// issue #164). It saves and gives back the whole aggregate root, `GameProgress`:
// the high score and the best result of each level of one game (S3-04).
// The device keeps one progress per game, so the game id finds it.
// `LocalProgressRepository` in layer 3 implements it over `KeyValueStore`.
export interface ProgressRepository {
  // Gives back the saved progress of the game, or `undefined` when the game has none.
  load(gameId: GameId): Promise<GameProgress | undefined>;
  // Saves the progress in place of the progress of its game that the repository holds.
  save(progress: GameProgress): Promise<void>;
}
