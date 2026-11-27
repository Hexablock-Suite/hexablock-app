import type { LevelRepository } from '../../application/level-repository';
import { LevelDefinition } from '../../domain/progress/level-definition';
import { LevelId } from '../../domain/progress/level-id';
import { GameId } from '../../domain/shared/game-id';
import type { LevelsApi } from './levels-api';

// Adapter of the `LevelRepository` port over the levels of hexablock-api (APP-FR-15, A6, #48,
// classes.md decision 22). It lives in layer 3, next to the DTO types, and it asks the transport
// interface `LevelsApi` for `GET /v1/levels` at each call. It keeps no copy of an answer.
// Each level of the answer is in the shared level format of a level file (S3-02), so
// `LevelDefinition.of()` reads it as `BundledLevelRepository` reads a file, and `GameId.of()`
// checks the `gameId`. A level that one of them refuses makes the call reject.
// `unavailable()` gives the id of each level of the game that the answer names in
// `unavailable`: the backend keeps that level, but the level breaks a rule (#307,
// hexablock-api#147). The app shows no code of a rule, so the adapter reads only the id.
// A failed request rejects each call. `CombinedLevelRepository` decides what the app plays
// without the backend.
export class ApiLevelRepository implements LevelRepository {
  constructor(private readonly api: LevelsApi) {}

  async list(gameId: GameId): Promise<LevelDefinition[]> {
    const { levels } = await this.api.getLevels();
    return levels.filter((level) => isOf(level, gameId)).map((level) => LevelDefinition.of(level));
  }

  // The level of the game whose level id is `levelId`, or `undefined` when the backend has none.
  async levelOf(gameId: GameId, levelId: LevelId): Promise<LevelDefinition | undefined> {
    const levels = await this.list(gameId);
    return levels.find((level) => level.levelId().equals(levelId));
  }

  // The backend leaves the field `unavailable` out when no stored level breaks a rule.
  async unavailable(gameId: GameId): Promise<LevelId[]> {
    const { unavailable = [] } = await this.api.getLevels();
    return unavailable
      .filter((level) => isOf(level, gameId))
      .map((level) => LevelId.of(level.levelId));
  }
}

// Whether the level `level` of an answer is a level of the game `gameId`.
function isOf(level: { readonly gameId: string }, gameId: GameId): boolean {
  return GameId.of(level.gameId).equals(gameId);
}
