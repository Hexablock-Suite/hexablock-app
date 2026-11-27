import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type FakeRoute = { status: number; body: unknown };

// One request that the fake backend received, with its body as text.
export type FakeRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

export type FakeBackend = { url: string; requests: FakeRequest[]; close: () => Promise<void> };

const closeServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

// Starts an HTTP server on a free local port. It answers each path with a fixed JSON body.
// Every other path answers 404. It keeps each request in requests, in the order of arrival.
export async function startFakeBackend(routes: Record<string, FakeRoute>): Promise<FakeBackend> {
  const requests: FakeRequest[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      requests.push({
        method: request.method ?? '',
        url: request.url ?? '',
        headers: request.headers,
        body,
      });
      const route = routes[request.url ?? ''];
      response.writeHead(route?.status ?? 404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(route?.body ?? { message: 'Not Found' }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, requests, close: () => closeServer(server) };
}

// Returns a local URL where no server listens.
export async function unusedBackendUrl(): Promise<string> {
  const backend = await startFakeBackend({});
  await backend.close();
  return backend.url;
}
