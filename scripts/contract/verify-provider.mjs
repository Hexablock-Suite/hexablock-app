// Verifies a running backend against the committed consumer pact.
// BACKEND_URL names the backend. The default is http://localhost:3000.
// The backend CI runs the same check from its side with the pact from client main.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Verifier } from '@pact-foundation/pact';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const verifier = new Verifier({
  provider: 'hexablock-api',
  providerBaseUrl: process.env.BACKEND_URL ?? 'http://localhost:3000',
  pactUrls: [path.join(repoRoot, 'pacts/hexablock-app-hexablock-api.json')],
  logLevel: 'warn',
  // GET /health needs no provider state.
  // When an interaction declares a state with given(), add stateChangeUrl here.
  // It points at a backend test route that prepares that state before each interaction.
});

try {
  await verifier.verifyProvider();
  console.log('The backend honors the hexablock-app pact.');
} catch (error) {
  console.error(`Pact verification failed: ${error.message}`);
  process.exitCode = 1;
}
