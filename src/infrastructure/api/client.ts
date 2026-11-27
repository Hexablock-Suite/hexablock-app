import createClient from 'openapi-fetch';

import type { AccountApi } from '../../adapters/api/account-api';
import { ApiFailure } from '../../adapters/api/api-failure';
import type { HealthApi } from '../../adapters/api/health-api';
import type { LeaderboardApi } from '../../adapters/api/leaderboard-api';
import type { LevelsApi } from '../../adapters/api/levels-api';
import type { ProgressApi } from '../../adapters/api/progress-api';
import type { paths } from './schema';

// The driver of the transport interfaces of layer 3 (classes.md decision 22, option A3).
// Each interface of `src/adapters/api/` covers one resource of hexablock-api.
export type ApiClient = HealthApi & AccountApi & ProgressApi & LeaderboardApi & LevelsApi;

// The longest wait for the answer of `GET /v1/levels`, in milliseconds (#48).
// `fetch` of React Native can wait with no end, so the client stops the request after it.
// No screen waits for this request: `ApiLevelRepository` answers from its last good answer.
export const LEVELS_TIMEOUT_MS = 5000;

// HTTP client for hexablock-api. The types come from the backend OpenAPI document.
// A call of `AccountApi`, `ProgressApi`, `LeaderboardApi` or `LevelsApi` that the backend does not
// answer with success rejects with an `ApiFailure` with the status of the answer (#45, #46, #47,
// #48). A call that gets no answer rejects with an `ApiFailure` with no status. The message of a
// failure names the call, never a body or a token.
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

    // The sync sends the bearer token of the session, as the token guard of the backend reads it.
    async syncProgress(token, body) {
      const { data, response } = await client.POST('/v1/progress', {
        body,
        headers: { Authorization: `Bearer ${token}` },
        fetch: answerOrFail,
      });
      if (!response.ok || data === undefined) throw failureOf(response, 'POST /v1/progress');
      return data;
    },

    // Both boards send the bearer token of the session, as the token guard of the backend reads it
    // (#47). The message of a failure names the path with no id and no token.
    async globalLeaderboard(token, gameId) {
      const { data, response } = await client.GET('/v1/leaderboard/{gameId}', {
        params: { path: { gameId } },
        headers: { Authorization: `Bearer ${token}` },
        fetch: answerOrFail,
      });
      if (!response.ok || data === undefined) {
        throw failureOf(response, 'GET /v1/leaderboard/{gameId}');
      }
      return data;
    },

    async levelLeaderboard(token, gameId, levelId) {
      const { data, response } = await client.GET('/v1/leaderboard/{gameId}/levels/{levelId}', {
        params: { path: { gameId, levelId } },
        headers: { Authorization: `Bearer ${token}` },
        fetch: answerOrFail,
      });
      if (!response.ok || data === undefined) {
        throw failureOf(response, 'GET /v1/leaderboard/{gameId}/levels/{levelId}');
      }
      return data;
    },

    // The stored levels (#48, #307). The route has no guard, so the request sends no token.
    // The client aborts the request after `LEVELS_TIMEOUT_MS`, and the call rejects as a call
    // with no answer. The timer stops when the request ends.
    async getLevels() {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), LEVELS_TIMEOUT_MS);
      try {
        const { data, response } = await client.GET('/v1/levels', {
          signal: abort.signal,
          fetch: answerOrFail,
        });
        if (!response.ok || data === undefined) throw failureOf(response, 'GET /v1/levels');
        return data;
      } finally {
        clearTimeout(timer);
      }
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
