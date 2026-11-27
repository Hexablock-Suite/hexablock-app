import { GameProgress } from '../domain/progress/game-progress';
import type { GameId } from '../domain/shared/game-id';
import type { AnonymousProgress } from './anonymous-progress';
import { SyncFailure, type ProgressGateway } from './progress-gateway';
import type { ProgressRepository } from './progress-repository';
import { caughtError, FailureCode, Result, UseCaseError } from './result';
import type { SessionStore } from './session-store';
import type { UseCase } from './use-case';

// The request of `SyncProgress`: the game whose local progress goes to the backend.
export interface SyncProgressRequest {
  readonly gameId: GameId;
}

// Sends the local progress of one game to the backend (APP-FR-13, D27, issue #46,
// docs/architecture/flows.md use case 2, classes.md decision 66).
// The local progress is always the store. With no session the use case sends nothing and
// changes nothing, so play with no account works offline. With a session it:
// 1. Merges the anonymous progress of the game, saved with no account, into the progress of the
//    account with `GameProgress.mergeWith()` (DS-12). It saves the merged progress, then forgets
//    the anonymous progress. So the progress merges into the first account that signs in.
// 2. Sends the progress of the account through the `ProgressGateway` port with the session.
//    A game with no local progress sends nothing.
// 3. Merges the answer of the backend into the local progress and saves it. So a better result of
//    another device reaches this device, and the best result stays.
// The `ProgressRepository` of the root puts the user id of the session in its key, so it gives
// the progress of the account. A failed sync never loses local progress: every step before a
// failure keeps its save, and the anonymous progress stays until the merged progress is saved.
// A refused token gives `session-expired` and clears the session through `SessionStore.clear()`,
// so the screen asks the player to sign in. No answer gives `backend-unreachable`. Any other
// failure gives `sync-failed`. No exception leaves `execute()` (decision 28).
export class SyncProgress implements UseCase<SyncProgressRequest, void> {
  constructor(
    private readonly sessions: SessionStore,
    private readonly progress: ProgressRepository,
    private readonly anonymous: AnonymousProgress,
    private readonly gateway: ProgressGateway,
  ) {}

  async execute(request: SyncProgressRequest): Promise<Result<void>> {
    try {
      const session = await this.sessions.read();
      if (session === undefined) return Result.success(undefined);
      const progress = await this.withAnonymous(request.gameId);
      if (progress === undefined) return Result.success(undefined);
      progress.mergeWith(await this.gateway.sync(session, progress));
      await this.progress.save(progress);
      return Result.success(undefined);
    } catch (thrown) {
      return this.failureOf(thrown);
    }
  }

  // The progress of the account with the anonymous progress of the game merged into it, or
  // `undefined` when the game has neither. The merged progress is saved before the anonymous
  // progress is forgotten, so a failed save keeps both.
  private async withAnonymous(gameId: GameId): Promise<GameProgress | undefined> {
    const own = await this.progress.load(gameId);
    const anonymous = await this.anonymous.loadAnonymous(gameId);
    if (anonymous === undefined) return own;
    const merged = own ?? GameProgress.start(gameId);
    merged.mergeWith(anonymous);
    await this.progress.save(merged);
    await this.anonymous.forgetAnonymous(gameId);
    return merged;
  }

  // The failure of a thrown value. A refused token also clears the session.
  private async failureOf(thrown: unknown): Promise<Result<void>> {
    if (!(thrown instanceof SyncFailure)) {
      return Result.failure(caughtError(FailureCode.syncFailed, thrown));
    }
    if (thrown.code === FailureCode.sessionExpired) await this.sessions.clear();
    return Result.failure(new UseCaseError(thrown.code, thrown.message, false, thrown));
  }
}
