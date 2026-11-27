import type { components } from './dto';

// The answer of `GET /v1/levels` of hexablock-api, as its OpenAPI document declares it: the valid
// levels in `levels` and, only when a stored level breaks a rule, that level in `unavailable`
// (hexablock-api#147, app #307).
export type LevelsDto = components['schemas']['LevelsDto'];

// The transport interface of the levels resource (layers.md, classes.md decision 22, option A3,
// #48). Layer 3 owns it, and `createApiClient()` of layer 4 implements it.
// It is not a port: layer 2 does not own it.
// Its methods take and give the DTO types of `dto.d.ts`, never a type of the HTTP library.
// A call that the backend does not answer with success rejects with an `ApiFailure`.
export interface LevelsApi {
  // Gives the stored levels of the backend. The request sends no token: `GET /v1/levels` has
  // no guard.
  getLevels(): Promise<LevelsDto>;
}
