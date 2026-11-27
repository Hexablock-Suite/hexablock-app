import type { GameProgress } from '../domain/progress/game-progress';
import type { GameId } from '../domain/shared/game-id';

// The anonymous space of the local progress (D27, issue #46, classes.md decision 66): the progress
// that the player saves with no account. It is a second role of the one repository of the progress
// aggregate, `LocalProgressRepository`, so `SaveProgress` and `ListLevels` do not see it (ISP).
// `SyncProgress` reads it at the first sync of an account, merges it into the progress of the
// account and forgets it. So the progress merges into the first account that signs in.
export interface AnonymousProgress {
  // Gives back the progress of the game that the player saved with no account, or `undefined`.
  loadAnonymous(gameId: GameId): Promise<GameProgress | undefined>;
  // Forgets the progress of the game that the player saved with no account.
  forgetAnonymous(gameId: GameId): Promise<void>;
}
