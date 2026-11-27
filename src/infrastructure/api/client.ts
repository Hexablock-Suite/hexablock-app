import createClient from 'openapi-fetch';

import type { AccountApi } from '../../adapters/api/account-api';
import { ApiFailure } from '../../adapters/api/api-failure';
import type { HealthApi } from '../../adapters/api/health-api';
import type { paths } from './schema';

// The driver of the transport interfaces of layer 3 (classes.md decision 22, option A3).
// Each interface of `src/adapters/api/` covers one resource of hexablock-api.
export type ApiClient = HealthApi & AccountApi;

// HTTP client for hexablock-api. The types come from the backend OpenAPI document.
// A call of `AccountApi` that the backend does not answer with success rejects with an
// `ApiFailure` with the status of the answer (#45). A call that gets no answer rejects with an
// `ApiFailure` with no status. The message of a failure names the call, never a body or a token.
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

    // The backend answers 201 with no body, so the client reads the body as text.
    async signUp(body) {
      const { response } = await client.POST('/v1/auth/register', {
        body,
        parseAs: 'text',
        fetch: answerOrFail,
      });
      if (!response.ok) throw failureOf(response, 'POST /v1/auth/register');
    },

    async signIn(body) {
      const { data, response } = await client.POST('/v1/auth/login', {
        body,
        fetch: answerOrFail,
      });
      if (!response.ok || data === undefined) throw failureOf(response, 'POST /v1/auth/login');
      return data;
    },

    // The bearer token goes in the Authorization header, as the token guard of the backend reads it.
    async currentUser(token) {
      const { data, response } = await client.GET('/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        fetch: answerOrFail,
      });
      if (!response.ok || data === undefined) throw failureOf(response, 'GET /v1/auth/me');
      return data;
    },
  };
}

// Sends one request. A request that gets no answer rejects with an `ApiFailure` with no status.
// The message names the method and the path of the request, never its body or its headers.
async function answerOrFail(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    throw new ApiFailure(
      undefined,
      `${request.method} ${new URL(request.url).pathname} got no answer.`,
    );
  }
}

// The failure of the call `call` with the status of its answer.
function failureOf(response: Response, call: string): ApiFailure {
  return new ApiFailure(response.status, `${call} answered ${response.status}.`);
}
