import type { LevelRepository } from '../application/ports/level-repository';
import { GameId } from '../domain/shared/game-id';
import { LevelDefinition } from '../domain/progress/level-definition';
import type { LevelId } from '../domain/progress/level-id';
import fit01 from './levels/fit/fit-01.json';
import fit02 from './levels/fit/fit-02.json';
import fit03 from './levels/fit/fit-03.json';
import fit04 from './levels/fit/fit-04.json';
import fit05 from './levels/fit/fit-05.json';
import fit06 from './levels/fit/fit-06.json';
import fit07 from './levels/fit/fit-07.json';
import fit08 from './levels/fit/fit-08.json';
import fit09 from './levels/fit/fit-09.json';
import fit10 from './levels/fit/fit-10.json';
import fit11 from './levels/fit/fit-11.json';
import fit12 from './levels/fit/fit-12.json';
import fit13 from './levels/fit/fit-13.json';
import fit14 from './levels/fit/fit-14.json';
import fit15 from './levels/fit/fit-15.json';
import fitSquare01 from './levels/fit/fit-square-01.json';
import fitSquare02 from './levels/fit/fit-square-02.json';
import fitSquare03 from './levels/fit/fit-square-03.json';
import fitTriangle01 from './levels/fit/fit-triangle-01.json';
import fitTriangle02 from './levels/fit/fit-triangle-02.json';
import fitTriangle03 from './levels/fit/fit-triangle-03.json';
import sort01 from './levels/sort/sort-01.json';
import sort02 from './levels/sort/sort-02.json';
import sort03 from './levels/sort/sort-03.json';
import sort04 from './levels/sort/sort-04.json';
import sort05 from './levels/sort/sort-05.json';
import sort06 from './levels/sort/sort-06.json';
import sort07 from './levels/sort/sort-07.json';
import sort08 from './levels/sort/sort-08.json';
import sort09 from './levels/sort/sort-09.json';
import sort10 from './levels/sort/sort-10.json';
import sortSquare01 from './levels/sort/sort-square-01.json';
import sortSquare02 from './levels/sort/sort-square-02.json';
import sortSquare03 from './levels/sort/sort-square-03.json';
import sortTriangle01 from './levels/sort/sort-triangle-01.json';
import sortTriangle02 from './levels/sort/sort-triangle-02.json';
import sortTriangle03 from './levels/sort/sort-triangle-03.json';

// The part of a level file that this adapter reads: the common part of the shared level format
// (hexablock-api `docs/level-format.md`, DS-6) and the section of the game.
// The `version` tells a bundled copy from a copy of the backend (DS-11, #48).
export interface LevelFile {
  readonly gameId: string;
  readonly levelId: string;
  readonly order: number;
  readonly version: number;
  readonly topology: string;
  readonly section: unknown;
}

// Every level file that the app bundles. Metro and Jest load each JSON file as an object,
// so the files need no file system on the device. A new level file adds one import here.
// The test of this adapter reads the folders, so a file that this list misses fails it.
const BUNDLED: readonly LevelFile[] = [
  fit01,
  fit02,
  fit03,
  fit04,
  fit05,
  fit06,
  fit07,
  fit08,
  fit09,
  fit10,
  fit11,
  fit12,
  fit13,
  fit14,
  fit15,
  fitSquare01,
  fitSquare02,
  fitSquare03,
  fitTriangle01,
  fitTriangle02,
  fitTriangle03,
  sort01,
  sort02,
  sort03,
  sort04,
  sort05,
  sort06,
  sort07,
  sort08,
  sort09,
  sort10,
  sortSquare01,
  sortSquare02,
  sortSquare03,
  sortTriangle01,
  sortTriangle02,
  sortTriangle03,
];

// Adapter of the `LevelRepository` port over the level files of the app
// (classes.md decisions 24 and 58, issue #168, A6). The files live in `src/adapters/levels/`,
// so rule `adapters-imports-only-inner-layers` lets this adapter import them.
// The bundled levels work offline (APP-FR-15).
// It gives the levels of a game: the files whose `gameId` names that game.
// `LevelDefinition.of()` checks the common part of each file, and `GameId.of()` checks
// the `gameId`. A file that one of them refuses makes `list()` throw.
// It finds one level of a game by its level id among the same files (issue #172).
// Every bundled file is a level that the app can give, so it names no unavailable level (#307).
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

  // No unavailable level: CI checks every bundled file (APP-FR-05).
  async unavailable(_gameId: GameId): Promise<LevelId[]> {
    return [];
  }
}
