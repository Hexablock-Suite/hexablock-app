import type { LevelId } from '../domain/progress/level-id';
import type { LevelStatus } from '../domain/progress/level-status';
import type { Stars } from '../domain/progress/stars';

// One level in the list of levels: the plain response model of `ListLevels` (issue #168).
// It holds no `LevelDefinition`, so a presenter cannot build a level from it.
// `levelId` names the level, and a later start request names the level with it (#172).
// `stars` exists only for a completed level: the stars of the best result of the level,
// which can be zero. A use case never opens a domain object: the presenter of layer 3
// receives the text of the id and the number of the stars with `deliverTo()` (decision 29).
export interface LevelSummary {
  readonly levelId: LevelId;
  readonly status: LevelStatus;
  readonly stars?: Stars;
}
