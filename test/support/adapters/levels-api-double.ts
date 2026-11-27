import type { LevelsApi, LevelsDto } from '../../../src/adapters/api/levels-api';
import type { LevelData } from '../contracts/level-repository-contract';

// One level that an answer of `GET /v1/levels` names as unavailable (#307): the stored level
// breaks a rule, and `reason` is the code of that rule.
export interface UnavailableData {
  readonly gameId: string;
  readonly levelId: string;
  readonly reason: string;
}

// A test double of the transport `LevelsApi` (#48). Each call answers the levels `levels`.
// It answers the field `unavailable` only when `unavailable` holds a level, as the backend
// leaves the field out when no stored level breaks a rule. It counts the calls.
export class AnsweringLevelsApi implements LevelsApi {
  private count = 0;

  constructor(
    private readonly levels: readonly LevelData[],
    private readonly unavailable: readonly UnavailableData[] = [],
  ) {}

  async getLevels(): Promise<LevelsDto> {
    this.count += 1;
    const levels = copyOf(this.levels) as unknown as LevelsDto['levels'];
    return this.unavailable.length === 0
      ? { levels }
      : { levels, unavailable: copyOf(this.unavailable) };
  }

  calls(): number {
    return this.count;
  }
}

// A new copy of plain data, so a caller that changes an answer changes no later answer.
function copyOf<T>(data: readonly T[]): T[] {
  return JSON.parse(JSON.stringify(data)) as T[];
}

// A transport with no network: each call rejects, as `fetch` does on a phone with no network.
// It counts the calls.
export class UnreachableLevelsApi implements LevelsApi {
  private count = 0;

  async getLevels(): Promise<LevelsDto> {
    this.count += 1;
    throw new TypeError('Network request failed');
  }

  calls(): number {
    return this.count;
  }
}
