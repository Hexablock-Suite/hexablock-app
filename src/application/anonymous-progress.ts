import type { GameId } from '../domain/shared/game-id';
import type { ProgressOwner } from './progress-owner';

// The anonymous space of the local progress (D27, issue #46, classes.md decision 66): the progress
// that the player saves with no account. It is a second role of the one repository of the progress
// aggregate, `LocalProgressRepository`, so `SaveProgress` and `ListLevels` do not see it (ISP).
// `Login`, `Register` and `SyncProgress` merge it into the progress of the account. So the
// progress merges into the first account that signs in.
export interface AnonymousProgress {
  // Merges the anonymous progress of the game into the progress of `owner` with
  // `GameProgress.mergeWith()` (DS-12), then forgets the anonymous progress. It forgets it only
  // after the merged progress is saved, so a failed save keeps it. A game with no anonymous
  // progress and the anonymous owner change nothing.
  mergeAnonymousInto(owner: ProgressOwner, gameId: GameId): Promise<void>;
}

// What a sign-in merges (#46, judgment-day round 1): the anonymous space and the id of each
// registered game. The merge is local and runs before any request of the sync.
export interface AnonymousMerge {
  readonly anonymous: AnonymousProgress;
  readonly gameIds: readonly GameId[];
}
