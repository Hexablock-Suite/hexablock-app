import { ProgressOwner } from '../../../src/application/ports/progress-owner';
import type { ProgressRepository } from '../../../src/application/ports/progress-repository';
import type { GameProgress } from '../../../src/domain/progress/game-progress';
import { contentOf } from '../engine/progress-content';

// Saves `progress` for `owner`, by default the anonymous owner, through `update()` of the port
// (#46). A test seeds a repository with it. The repository merges `progress` into the stored
// progress with `mergeWith()`, so a repository with no progress of the game keeps `progress` as it is.
export function saveIn(
  repository: ProgressRepository,
  progress: GameProgress,
  owner: ProgressOwner = ProgressOwner.anonymous,
): Promise<void> {
  return repository.update(owner, contentOf(progress).gameId, (stored) =>
    stored.mergeWith(progress),
  );
}
