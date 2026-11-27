import type { FakeRequest, FakeRoutes } from './fake-backend';

// A `fetch` that answers each request from the routes of a fake backend, with no socket, and the
// requests that it received, in the order of arrival. The `app` project of Jest runs the fetch of
// Expo, which has no native module there, so a test of that project replaces the global `fetch`
// with this one. A path with no route answers 404. `unreachable` rejects each request, as a
// phone with no network does.
export type FakeFetch = {
  readonly requests: FakeRequest[];
  readonly fetch: (input: Request) => Promise<Response>;
};

export function fakeFetch(routes: FakeRoutes, unreachable = false): FakeFetch {
  const requests: FakeRequest[] = [];
  return {
    requests,
    fetch: async (input) => {
      const url = new URL(input.url);
      const headers: Record<string, string> = {};
      input.headers.forEach((value, name) => {
        headers[name.toLowerCase()] = value;
      });
      const received: FakeRequest = {
        method: input.method,
        url: `${url.pathname}${url.search}`,
        headers,
        body: await input.text(),
      };
      requests.push(received);
      if (unreachable) throw new TypeError('Network request failed');
      const answer = routes[received.url];
      const route = typeof answer === 'function' ? answer(received) : answer;
      return new Response(JSON.stringify(route?.body ?? { message: 'Not Found' }), {
        status: route?.status ?? 404,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };
}

// The requests of `fake` other than the requests of the levels, in the order of arrival. The
// composition root asks the backend for its levels when it is built and when a screen reads the
// levels (#48), so a test of another resource reads its own requests with it.
export function requestsBesideLevels(fake: FakeFetch): FakeRequest[] {
  return fake.requests.filter(({ url }) => url !== '/v1/levels');
}

// Replaces the global `fetch` with `fake` until the spy is restored.
export function useFakeFetch(fake: FakeFetch): jest.SpyInstance {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input) => fake.fetch(input as Request));
}
