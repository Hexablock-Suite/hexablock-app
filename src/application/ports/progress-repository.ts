import type { GameId } from '../../domain/shared/game-id';
import type { GameProgress } from '../../domain/progress/game-progress';
import type { ProgressOwner } from './progress-owner';

// Output port and repository of the progress aggregate (classes.md decisions 52, 56, 57 and 66,
// issues #164 and #46). It saves and gives back the whole aggregate root, `GameProgress`:
// the high score and the best result of each level of one game (S3-04).
// The device keeps one progress per owner and game, so the owner and the game id find it.
// A use case reads the owner once with `owner()` and gives it to each later call, so one operation
// never uses two keys.
// `LocalProgressRepository` in layer 3 implements it over `KeyValueStore`.
export interface ProgressRepository {
  // The owner of the progress now: the last signed-in user, or the anonymous owner.
  // An owner that cannot be read gives the anonymous owner: the web build has no secure storage
  // (#45), and `SaveProgress` and `ListLevels` need no session (D27).
  owner(): Promise<ProgressOwner>;
  // Gives back the saved progress of the game of `owner`, or `undefined` when it has none.
  load(owner: ProgressOwner, gameId: GameId): Promise<GameProgress | undefined>;
  // Loads the progress of the game of `owner`, or starts one, gives it to `change` and saves it.
  // The three steps run in one queue per owner and game, so a second `update()` of the same
  // progress starts only after the first one ends, and no change is lost (#46).
  // A `change` that throws saves nothing, and `update()` rejects with the thrown value.
  update(
    owner: ProgressOwner,
    gameId: GameId,
    change: (progress: GameProgress) => void,
  ): Promise<void>;
}
