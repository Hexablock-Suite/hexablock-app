import { SyncFailure, type ProgressGateway } from '../../application/ports/progress-gateway';
import { FailureCode } from '../../application/result';
import type { Session } from '../../application/ports/session';
import type { GameProgress } from '../../domain/progress/game-progress';
import type { ApiDtoMapper } from './api-dto-mapper';
import { ApiFailure } from './api-failure';
import type { ProgressApi } from './progress-api';

// Adapter of the `ProgressGateway` port over hexablock-api (APP-FR-13, D27, classes.md decisions 22
// and 66, flows.md use case 2). It lives in layer 3, `src/adapters/api/`, and calls the backend
// through the transport interface `ProgressApi`, which `ApiClient` of layer 4 implements.
// `ApiDtoMapper` builds the body of the sync and the `GameProgress` of the answer.
// A sync sends `POST /v1/progress` with the token of the session. The backend keeps the best result
// of each level (DS-12) and answers with the progress entry after the sync, so one call sends the
// local progress and brings back the results of other devices.
// A 401 throws the `SyncFailure` of `session-expired`, and a call with no answer throws the one of
// `backend-unreachable`. Any other failure goes on as it is, and the use case gives `sync-failed`:
// for example a 400 for a level that the backend does not hold (`unknown-level`).
export class ApiProgressGateway implements ProgressGateway {
  constructor(
    private readonly api: ProgressApi,
    private readonly mapper: ApiDtoMapper,
  ) {}

  async sync(session: Session, progress: GameProgress): Promise<GameProgress> {
    const body = this.mapper.toSyncProgressDto(progress);
    const answer = await answerOf(() => this.api.syncProgress(session.token, body));
    return this.mapper.toGameProgress(answer);
  }
}

// The answer of `call`. An `ApiFailure` of status 401 throws the `SyncFailure` of
// `session-expired`, and an `ApiFailure` with no status throws the one of `backend-unreachable`.
// The failure keeps the message of the `ApiFailure`, which names the call and its status only.
async function answerOf<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (thrown) {
    if (!(thrown instanceof ApiFailure)) throw thrown;
    if (thrown.status === undefined) {
      throw new SyncFailure(FailureCode.backendUnreachable, thrown.message);
    }
    if (thrown.status === 401) throw new SyncFailure(FailureCode.sessionExpired, thrown.message);
    throw thrown;
  }
}
