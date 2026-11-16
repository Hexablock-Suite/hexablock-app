import type { LevelRepository } from '../application/level-repository';
import { GameId } from '../domain/engine/game-id';
import { LevelDefinition } from '../domain/engine/level-definition';
import type { LevelId } from '../domain/engine/level-id';
import fit01 from './levels/fit/fit-01.json';
import fit02 from './levels/fit/fit-02.json';
import fit03 from './levels/fit/fit-03.json';
import sort01 from './levels/sort/sort-01.json';
import sort02 from './levels/sort/sort-02.json';
import sort03 from './levels/sort/sort-03.json';

// The part of a level file that this adapter reads: the common part of the shared level format
// (hexablock-api `docs/level-format.md`, DS-6) and the section of the game.
// The adapter reads no `version` yet: DS-11 compares a bundled copy with a copy of the API later.
export interface LevelFile {
  readonly gameId: string;
  readonly levelId: string;
  readonly order: number;
  readonly topology: string;
  readonly section: unknown;
}

// Every level file that the app bundles. Metro and Jest load each JSON file as an object,
// so the files need no file system on the device. A new level file adds one import here.
// The test of this adapter reads the folders, so a file that this list misses fails it.
const BUNDLED: readonly LevelFile[] = [fit01, fit02, fit03, sort01, sort02, sort03];

// Adapter of the `LevelRepository` port over the level files of the app
// (classes.md decisions 24 and 58, issue #168, A6). The files live in `src/adapters/levels/`,
// so rule `adapters-imports-only-inner-layers` lets this adapter import them.
// The bundled levels work offline (APP-FR-15).
// It gives the levels of a game: the files whose `gameId` names that game.
// `LevelDefinition.of()` checks the common part of each file, and `GameId.of()` checks
// the `gameId`. A file that one of them refuses makes `list()` throw.
// It finds one level of a game by its level id among the same files (issue #172).
// A test can give other files to the constructor, for example a square level.
export class BundledLevelRepository implements LevelRepository {
  constructor(private readonly files: readonly LevelFile[] = BUNDLED) {}

  async list(gameId: GameId): Promise<LevelDefinition[]> {
    return this.files
      .filter((file) => GameId.of(file.gameId).equals(gameId))
      .map((file) => LevelDefinition.of(file));
  }

  // The level of the game whose level id is `levelId`, or `undefined` when the game has none.
  async levelOf(gameId: GameId, levelId: LevelId): Promise<LevelDefinition | undefined> {
    const levels = await this.list(gameId);
    return levels.find((level) => level.levelId().equals(levelId));
  }
}
