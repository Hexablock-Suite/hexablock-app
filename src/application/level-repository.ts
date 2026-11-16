import type { GameId } from '../domain/engine/game-id';
import type { LevelDefinition } from '../domain/engine/level-definition';
import type { LevelId } from '../domain/engine/level-id';

// Output port of the levels of a game (classes.md decisions 24 and 58, issue #168, A6).
// It gives the `LevelDefinition` of each level of one game: the data of one level file.
// A level is data that the player never changes, so the port only reads.
// `BundledLevelRepository` in layer 3 implements it over the level files of the app,
// so the bundled levels work offline (APP-FR-15). `ApiLevelRepository` of layer 4 is planned.
// `ListLevels` asks for the levels of a game, and the definition answers the questions
// of the list: its level id, its order and its figure.
// `LevelGameFactories` asks for the one level that a game starts (issue #172).
export interface LevelRepository {
  // Gives the definition of each level of the game, in no fixed order, in a new list.
  // A game with no levels gives an empty list.
  list(gameId: GameId): Promise<LevelDefinition[]>;
  // Gives the definition of the level `levelId` of the game.
  // It gives `undefined` when the game has no level with this id.
  levelOf(gameId: GameId, levelId: LevelId): Promise<LevelDefinition | undefined>;
}
