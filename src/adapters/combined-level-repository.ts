import type { LevelRepository } from '../application/level-repository';
import type { LevelDefinition } from '../domain/progress/level-definition';
import type { LevelId } from '../domain/progress/level-id';
import type { GameId } from '../domain/shared/game-id';

// Adapter of the `LevelRepository` port that joins the bundled levels and the levels of the
// backend (APP-FR-15, A6, DS-11, #48). It is a Composite: it implements the port over two
// repositories of the same port, and the composition root gives it `BundledLevelRepository`
// and `ApiLevelRepository`.
// - The bundled levels always come. A failure of the bundled repository rejects the call.
// - A failure of the backend repository counts as a backend with no level. So with the network
//   off, every bundled level lists and opens, and no use case fails with `list-failed`.
// - A backend level whose id no bundled level has adds a level, after the bundled levels.
// - When both repositories hold a copy of one level, `LevelDefinition.replaces()` decides
//   (DS-11): the backend copy takes the place of the bundled copy only with a higher version.
//   With an equal version, the app keeps the bundled copy.
// - `unavailable()` gives each unavailable backend level that no bundled level has (#307).
//   A bundled copy of an unavailable level wins, and the player plays it.
// `ListLevels` orders the levels of a figure by the `order` of each copy, and its sort is
// stable: a bundled level comes before a backend level of the same order.
export class CombinedLevelRepository implements LevelRepository {
  constructor(
    private readonly bundled: LevelRepository,
    private readonly backend: LevelRepository,
  ) {}

  async list(gameId: GameId): Promise<LevelDefinition[]> {
    const [bundled, backend] = await Promise.all([
      this.bundled.list(gameId),
      orNone(this.backend.list(gameId)),
    ]);
    const kept = bundled.map((copy) => backend.find((other) => other.replaces(copy)) ?? copy);
    const added = backend.filter((level) => !hasCopyOf(bundled, level.levelId()));
    return [...kept, ...added];
  }

  // The level of the game whose level id is `levelId` in the joined list, or `undefined`.
  async levelOf(gameId: GameId, levelId: LevelId): Promise<LevelDefinition | undefined> {
    const levels = await this.list(gameId);
    return levels.find((level) => level.levelId().equals(levelId));
  }

  async unavailable(gameId: GameId): Promise<LevelId[]> {
    const [bundled, ownUnavailable, backend] = await Promise.all([
      this.bundled.list(gameId),
      this.bundled.unavailable(gameId),
      orNone(this.backend.unavailable(gameId)),
    ]);
    return [...ownUnavailable, ...backend.filter((levelId) => !hasCopyOf(bundled, levelId))];
  }
}

// The list of `call`, or an empty list when `call` rejects: the backend did not answer.
async function orNone<T>(call: Promise<T[]>): Promise<T[]> {
  try {
    return await call;
  } catch {
    return [];
  }
}

// Whether `levels` holds a level with the id `levelId`.
function hasCopyOf(levels: readonly LevelDefinition[], levelId: LevelId): boolean {
  return levels.some((level) => level.levelId().equals(levelId));
}
