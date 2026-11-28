import type { GameId } from '../../domain/shared/game-id';
import type { AnonymousProgress } from '../ports/anonymous-progress';
import { SyncFailure, type ProgressGateway } from '../ports/progress-gateway';
import { ProgressOwner } from '../ports/progress-owner';
import type { ProgressRepository } from '../ports/progress-repository';
import { caughtError, FailureCode, Result, UseCaseError } from '../result';
import type { SessionStore } from '../ports/session-store';
import type { UseCase } from '../use-case';

// The request of `SyncProgress`: the game whose local progress goes to the backend.
export interface SyncProgressRequest {
  readonly gameId: GameId;
}

// Sends the local progress of one game to the backend (APP-FR-13, D27, issue #46,
// docs/architecture/flows.md use case 2, classes.md decision 66).
// The local progress is always the store. With no session the use case sends nothing and
// changes nothing, so play with no account works offline. With a session it reads the session once:
// the user of the session is the owner of the progress for the whole sync, even when the session
// changes during the request. Then it:
// 1. Merges the anonymous progress of the game, saved with no account, into the progress of the
//    owner through `AnonymousProgress` (DS-12). The repository forgets the anonymous progress only
//    after it saves the merged progress. A sign-in already merged it, so this step only repeats a
//    merge that failed.
// 2. Sends the progress of the owner through the `ProgressGateway` port with the session.
//    A game with no local progress sends nothing. The request runs outside the queue of the
//    repository, so a save of the game can run while the request waits.
// 3. Merges the answer of the backend, through `ProgressRepository.update()`, into the progress that
//    the repository holds at that moment. So a result saved during the request stays, a better
//    result of another device reaches this device, and the best result stays.
// A session that cannot be read gives `sync-failed` and writes nothing. A failed sync never loses
// local progress: every step before a failure keeps its save.
// A refused token gives `session-expired`, so the screen asks the player to sign in and the player
// keeps the progress. The use case never clears the session: `SessionAspect` clears it (#481).
// No answer gives `backend-unreachable`. Any other failure gives `sync-failed`.
// No exception leaves `execute()` (decision 28).
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
      const owner = ProgressOwner.of(session.userId);
      await this.anonymous.mergeAnonymousInto(owner, request.gameId);
      const progress = await this.progress.load(owner, request.gameId);
      if (progress === undefined) return Result.success(undefined);
      const answer = await this.gateway.sync(session, progress);
      await this.progress.update(owner, request.gameId, (stored) => stored.mergeWith(answer));
      return Result.success(undefined);
    } catch (thrown) {
      return this.failureOf(thrown);
    }
  }

  // The failure of a thrown value.
  private failureOf(thrown: unknown): Result<void> {
    if (!(thrown instanceof SyncFailure)) {
      return Result.failure(caughtError(FailureCode.syncFailed, thrown));
    }
    return Result.failure(new UseCaseError(thrown.code, thrown.message, false, thrown));
  }
}
