import type { GameId } from '../../domain/shared/game-id';
import type { LevelDefinition } from '../../domain/progress/level-definition';
import type { LevelId } from '../../domain/progress/level-id';

// Output port of the levels of a game (classes.md decisions 24 and 58, issue #168, A6).
// It gives the `LevelDefinition` of each level of one game: the data of one level file.
// A level is data that the player never changes, so the port only reads.
// `BundledLevelRepository` in layer 3 implements it over the level files of the app,
// so the bundled levels work offline (APP-FR-15). `ApiLevelRepository` of layer 3 implements it over
// the levels of hexablock-api, and `CombinedLevelRepository` joins the two with the rule of DS-11
// (#48).
// `ListLevels` asks for the levels of a game, and the definition answers the questions
// of the list: its level id, its order and its figure.
// `LevelGameFactories` asks for the one level that a game starts (issue #172).
// `ListLevels` also asks for the unavailable levels of a game, and lists them apart (#307).
export interface LevelRepository {
  // Gives the definition of each level of the game, in no fixed order, in a new list.
  // A game with no levels gives an empty list.
  list(gameId: GameId): Promise<LevelDefinition[]>;
  // Gives the definition of the level `levelId` of the game.
  // It gives `undefined` when the game has no level with this id.
  levelOf(gameId: GameId, levelId: LevelId): Promise<LevelDefinition | undefined>;
  // Gives the id of each unavailable level of the game, in no fixed order, in a new list (#307).
  // An unavailable level is a level that the source names but cannot give, because it breaks a
  // rule. `list()` and `levelOf()` never give it. A source that gives every level gives an
  // empty list.
  unavailable(gameId: GameId): Promise<LevelId[]>;
}
