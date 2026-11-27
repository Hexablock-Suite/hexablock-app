import type { AccountApi } from '../../../src/adapters/api/account-api';
import { ApiFailure } from '../../../src/adapters/api/api-failure';
import type { LeaderboardApi } from '../../../src/adapters/api/leaderboard-api';
import type { LevelsApi, LevelsDto } from '../../../src/adapters/api/levels-api';
import type { ProgressApi } from '../../../src/adapters/api/progress-api';
import type { LevelData } from '../contracts/level-repository-contract';

// One level that an answer of `GET /v1/levels` names as unavailable (#307): the stored level
// breaks a rule, and `reason` is the code of that rule.
export interface UnavailableData {
  readonly gameId: string;
  readonly levelId: string;
  readonly reason: string;
}

// The answer of `GET /v1/levels` with the levels `levels`. It holds the field `unavailable` only
// when `unavailable` holds a level, as the backend leaves the field out when no stored level
// breaks a rule. Each call gives a new copy, so a caller that changes an answer changes no later
// answer.
export function levelsAnswer(
  levels: readonly LevelData[],
  unavailable: readonly UnavailableData[] = [],
): LevelsDto {
  const copied = copyOf(levels) as unknown as LevelsDto['levels'];
  return unavailable.length === 0
    ? { levels: copied }
    : { levels: copied, unavailable: copyOf(unavailable) };
}

// A new copy of plain data.
function copyOf<T>(data: readonly T[]): T[] {
  return JSON.parse(JSON.stringify(data)) as T[];
}

// A test double of the transport `LevelsApi` (#48). Each call answers the levels `levels` and the
// unavailable levels `unavailable` at once. It counts the calls.
export class AnsweringLevelsApi implements LevelsApi {
  private count = 0;

  constructor(
    private readonly levels: readonly LevelData[],
    private readonly unavailable: readonly UnavailableData[] = [],
  ) {}

  async getLevels(): Promise<LevelsDto> {
    this.count += 1;
    return levelsAnswer(this.levels, this.unavailable);
  }

  calls(): number {
    return this.count;
  }
}

// A transport with no network: each call rejects with an `ApiFailure` with no status, as the
// client does on a phone with no network. It counts the calls.
export class UnreachableLevelsApi implements LevelsApi {
  private count = 0;

  async getLevels(): Promise<LevelsDto> {
    this.count += 1;
    throw new ApiFailure(undefined, 'GET /v1/levels got no answer.');
  }

  calls(): number {
    return this.count;
  }
}

// A transport whose requests wait until the test answers them (#48). Each call adds one pending
// request. `answer()` and `fail()` settle the oldest pending request, so a test decides the order
// of each step and needs no timer. A request that the test never settles hangs, as `fetch` of
// React Native can.
export class DeferredLevelsApi implements LevelsApi {
  private readonly pending: {
    readonly resolve: (answer: LevelsDto) => void;
    readonly reject: (error: unknown) => void;
  }[] = [];
  private count = 0;

  getLevels(): Promise<LevelsDto> {
    this.count += 1;
    return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
  }

  // Answers the oldest pending request with `answer`.
  answer(answer: LevelsDto): void {
    this.oldest().resolve(answer);
  }

  // Rejects the oldest pending request with `error`.
  fail(error: unknown): void {
    this.oldest().reject(error);
  }

  calls(): number {
    return this.count;
  }

  private oldest() {
    const request = this.pending.shift();
    if (request === undefined) throw new Error('No request of the levels is pending.');
    return request;
  }
}

// The transport `api` of the root with the levels of `levels`. The other resources reject each
// call with an `ApiFailure` with no status, as a backend with no answer does. A root with no
// secure storage calls none of them.
export function backendWithLevels(
  levels: LevelsApi,
): AccountApi & ProgressApi & LeaderboardApi & LevelsApi {
  const noAnswer = () => Promise.reject(new ApiFailure(undefined, 'The double answers no call.'));
  return {
    signUp: noAnswer,
    signIn: noAnswer,
    currentUser: noAnswer,
    syncProgress: noAnswer,
    globalLeaderboard: noAnswer,
    levelLeaderboard: noAnswer,
    getLevels: () => levels.getLevels(),
  };
}

// The `setImmediate` of the platform, kept when this module loads. `renderRouter()` of the router
// testing library turns on the fake timers of Jest, which replace the global one.
const realSetImmediate = globalThis.setImmediate;

// Resolves after every pending promise callback has run: the refresh in the background of a
// repository finishes before it. It waits for no time.
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => realSetImmediate(resolve));
}
