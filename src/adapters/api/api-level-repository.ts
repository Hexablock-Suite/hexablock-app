import type { LevelRepository } from '../../application/level-repository';
import { LevelDefinition } from '../../domain/progress/level-definition';
import { LevelId } from '../../domain/progress/level-id';
import type { GameId } from '../../domain/shared/game-id';
import { valueOf } from '../delivered';
import type { LevelsDto, LevelsApi } from './levels-api';

// One level of the last good answer, with the text of the `gameId` of its row.
interface BackendLevel {
  readonly gameId: string;
  readonly definition: LevelDefinition;
}

// One unavailable level of the last good answer (#307), with the text of the `gameId` of its row.
interface BackendGap {
  readonly gameId: string;
  readonly levelId: LevelId;
}

// The last good answer, read into domain values.
interface ReadAnswer {
  readonly levels: readonly BackendLevel[];
  readonly unavailable: readonly BackendGap[];
}

// Adapter of the `LevelRepository` port over the levels of hexablock-api (APP-FR-15, A6, #48,
// classes.md decisions 22 and 68). It lives in layer 3, next to the DTO types, and it reads
// `GET /v1/levels` through the transport interface `LevelsApi`.
// No use case waits for the network (D27, option B of the decision of 2026-11-27 on #48):
// - The adapter keeps the last good answer in memory. Nothing goes to the device.
// - `list()`, `levelOf()` and `unavailable()` answer from that answer at once. Before the first
//   good answer, the adapter holds no backend level.
// - Each call also starts one refresh when none is in flight, so a new backend level appears on
//   the next call. One request serves every call that comes while it is in flight.
// - A refresh that fails keeps the last good answer. An answer with a level that
//   `LevelDefinition.of()` or `LevelId.of()` refuses counts as a failed refresh, so the adapter
//   never keeps a part of an answer.
// Each level of the answer is in the shared level format of a level file (S3-02), so
// `LevelDefinition.of()` reads it as `BundledLevelRepository` reads a file.
// `unavailable()` gives the id of each level of the game that the answer names in
// `unavailable`: the backend keeps that level, but the level breaks a rule (#307,
// hexablock-api#147). The app shows no code of a rule, so the adapter reads only the id.
// The adapter compares the text of the `gameId` of a row, so a row of a game that the app does
// not know is no error.
export class ApiLevelRepository implements LevelRepository {
  private answer: ReadAnswer = { levels: [], unavailable: [] };
  private inFlight: Promise<void> | undefined;

  constructor(private readonly api: LevelsApi) {}

  // Starts one request of the levels, or gives the request in flight. The promise resolves when
  // the request ends, and it never rejects. The composition root calls it when it builds the
  // adapter, so the first screen after the answer shows the backend levels.
  refresh(): Promise<void> {
    this.inFlight ??= this.read().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  async list(gameId: GameId): Promise<LevelDefinition[]> {
    void this.refresh();
    const game = valueOf(gameId);
    return this.answer.levels
      .filter((level) => level.gameId === game)
      .map((level) => level.definition);
  }

  // The level of the game whose level id is `levelId`, or `undefined` when the backend has none.
  async levelOf(gameId: GameId, levelId: LevelId): Promise<LevelDefinition | undefined> {
    const levels = await this.list(gameId);
    return levels.find((level) => level.levelId().equals(levelId));
  }

  async unavailable(gameId: GameId): Promise<LevelId[]> {
    void this.refresh();
    const game = valueOf(gameId);
    return this.answer.unavailable.filter((gap) => gap.gameId === game).map((gap) => gap.levelId);
  }

  // Reads one answer of the backend. A failed request or an answer that the app cannot read
  // keeps the last good answer.
  private async read(): Promise<void> {
    try {
      this.answer = readAnswer(await this.api.getLevels());
    } catch {
      // The last good answer stays. The next call starts a new refresh.
    }
  }
}

// The domain values of `answer`. A level or an id that the domain refuses throws.
// The backend leaves the field `unavailable` out when no stored level breaks a rule.
function readAnswer(answer: LevelsDto): ReadAnswer {
  return {
    levels: answer.levels.map((level) => ({
      gameId: level.gameId,
      definition: LevelDefinition.of(level),
    })),
    unavailable: (answer.unavailable ?? []).map((gap) => ({
      gameId: gap.gameId,
      levelId: LevelId.of(gap.levelId),
    })),
  };
}
