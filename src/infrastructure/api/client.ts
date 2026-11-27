import createClient from 'openapi-fetch';

import type { HealthApi } from '../../adapters/api/health-api';
import type { LevelsApi } from '../../adapters/api/levels-api';
import type { paths } from './schema';

// The driver of the transport interfaces of layer 3 (classes.md decision 22, option A3).
// Each interface of `src/adapters/api/` covers one resource of hexablock-api.
export type ApiClient = HealthApi & LevelsApi;

// The longest wait for the answer of `GET /v1/levels`, in milliseconds (#48).
// `fetch` of React Native can wait with no end, so the client stops the request after it,
// and the app plays its bundled levels.
export const LEVELS_TIMEOUT_MS = 5000;

// HTTP client for hexablock-api. The types come from the backend OpenAPI document.
// `levelsTimeoutMs` is the time limit of the request of the levels.
export function createApiClient(baseUrl: string, levelsTimeoutMs = LEVELS_TIMEOUT_MS): ApiClient {
  const client = createClient<paths>({ baseUrl });

  return {
    async getHealth() {
      const { data, response } = await client.GET('/v1/health');
      if (data === undefined) {
        throw new Error(`GET /v1/health failed with status ${response.status}`);
      }
      return data;
    },

    // The stored levels (#48, #307). The request stops after `levelsTimeoutMs`, and the call
    // rejects. The timer stops when the answer arrives.
    async getLevels() {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), levelsTimeoutMs);
      try {
        const { data, response } = await client.GET('/v1/levels', { signal: abort.signal });
        if (data === undefined) {
          throw new Error(`GET /v1/levels failed with status ${response.status}`);
        }
        return data;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
