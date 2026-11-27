import createClient from 'openapi-fetch';

import type { HealthApi } from '../../adapters/api/health-api';
import type { paths } from './schema';

// The driver of the transport interfaces of layer 3 (classes.md decision 22, option A3).
// Each interface of `src/adapters/api/` covers one resource of hexablock-api.
export type ApiClient = HealthApi;

// HTTP client for hexablock-api. The types come from the backend OpenAPI document.
export function createApiClient(baseUrl: string): ApiClient {
  const client = createClient<paths>({ baseUrl });

  return {
    async getHealth() {
      const { data, response } = await client.GET('/v1/health');
      if (data === undefined) {
        throw new Error(`GET /v1/health failed with status ${response.status}`);
      }
      return data;
    },
  };
}
