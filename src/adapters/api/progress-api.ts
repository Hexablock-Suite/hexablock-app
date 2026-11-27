import type { components } from './dto';

// The body of a sync: the game, its high score and the result of each level (API-FR-02).
export type SyncProgressDto = components['schemas']['SyncProgressDto'];
// One level result of a sync and of its answer. Each field is required.
export type LevelResultDto = components['schemas']['LevelResultDto'];
// The answer of a sync: the progress entry that the backend keeps for the user and the game.
export type ProgressDto = components['schemas']['ProgressDto'];

// The transport interface of the progress resource (layers.md, classes.md decision 22, option A3,
// #46). Layer 3 owns it, and `createApiClient()` of layer 4 implements it.
// It is not a port: layer 2 does not own it.
// Its methods take and give the DTO types of `dto.d.ts`, never a type of the HTTP library.
// A call that the backend does not answer with success rejects with an `ApiFailure`.
export interface ProgressApi {
  // Sends the progress of one game for the account of the bearer token `token` and gives the
  // progress entry after the sync. The request sends the token.
  syncProgress(token: string, body: SyncProgressDto): Promise<ProgressDto>;
}
