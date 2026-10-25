import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type FakeRoute = { status: number; body: unknown };

export type FakeBackend = { url: string; close: () => Promise<void> };

const closeServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

// Starts an HTTP server on a free local port. It answers each path with a fixed JSON body.
// Every other path answers 404.
export async function startFakeBackend(routes: Record<string, FakeRoute>): Promise<FakeBackend> {
  const server = createServer((request, response) => {
    const route = routes[request.url ?? ''];
    response.writeHead(route?.status ?? 404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(route?.body ?? { message: 'Not Found' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => closeServer(server) };
}

// Returns a local URL where no server listens.
export async function unusedBackendUrl(): Promise<string> {
  const backend = await startFakeBackend({});
  await backend.close();
  return backend.url;
}
