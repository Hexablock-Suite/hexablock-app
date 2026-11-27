import type { components } from './dto';

// The health answer of hexablock-api, as its OpenAPI document declares it.
export type HealthDto = components['schemas']['HealthResponse'];

// The transport interface of the health resource (layers.md, classes.md decision 22, option A3).
// Layer 3 owns it, and `createApiClient()` of layer 4 implements it.
// It is not a port: layer 2 does not own it.
// Its methods take and give the DTO types of `dto.d.ts`, never a type of the HTTP library.
export interface HealthApi {
  // The health answer of the backend. It throws when the backend does not answer 200.
  getHealth(): Promise<HealthDto>;
}
