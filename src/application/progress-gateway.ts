import type { GameProgress } from '../domain/progress/game-progress';
import type { FailureCode } from './result';
import type { Session } from './session';

// The failure codes of a sync that the backend gives, or that its silence gives (issue #46).
// `session-expired` names a token that the backend refuses: it lives 24 hours and has no refresh.
export type SyncFailureCode =
  | typeof FailureCode.sessionExpired
  | typeof FailureCode.backendUnreachable;

// The error that a `ProgressGateway` throws for a known failure (APP-FR-13): the backend refuses
// the token, or it gives no answer. `code` is the failure code of the use case.
// Any other thrown value is a failure of the gateway itself.
export class SyncFailure extends Error {
  constructor(
    readonly code: SyncFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'SyncFailure';
  }
}

// Output port of the sync of the progress (APP-FR-13, D27, classes.md decision 66).
// `SyncProgress` calls the backend through it. `ApiProgressGateway` of layer 3,
// `src/adapters/api/`, implements it (decision 22). It is not a repository: the local progress
// stays the store, and the gateway only sends a progress and gives back the answer.
// A known failure throws a `SyncFailure`.
export interface ProgressGateway {
  // Sends `progress` for the account of `session` and gives the progress that the backend keeps
  // for that account and game after the sync. The backend keeps the best result (DS-12).
  sync(session: Session, progress: GameProgress): Promise<GameProgress>;
}
