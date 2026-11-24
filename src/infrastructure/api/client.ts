import createClient from 'openapi-fetch';

import type { paths } from './schema';

export type HealthResponse =
  paths['/v1/health']['get']['responses'][200]['content']['application/json'];

export type ApiClient = {
  getHealth: () => Promise<HealthResponse>;
};

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
