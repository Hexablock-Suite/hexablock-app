// Verifies a running backend against the committed consumer pact.
// BACKEND_URL names the backend. The default is http://localhost:3000.
// The backend CI runs the same check from its side with the pact from client main.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Verifier } from '@pact-foundation/pact';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';

const verifier = new Verifier({
  provider: 'hexablock-api',
  providerBaseUrl: backendUrl,
  pactUrls: [path.join(repoRoot, 'pacts/hexablock-app-hexablock-api.json')],
  logLevel: 'warn',
  // The interactions of the account (#45) declare a provider state with given().
  // Before and after each interaction, the verifier posts to the state-change endpoint of
  // hexablock-api #151, also for an interaction with no state. Only the provider composition of
  // the API mounts that endpoint: `node --env-file=.env.example scripts/contract/start-provider.js`
  // in hexablock-api. Pact JS 17 logs that this option is deprecated, but it still applies it.
  // A state can give values, such as the token of `a signed-in account exists`, and the verifier
  // puts them into the request.
  providerStatesSetupUrl: new URL('/v1/_pact/provider-states', backendUrl).href,
});

try {
  await verifier.verifyProvider();
  console.log('The backend honors the hexablock-app pact.');
} catch (error) {
  console.error(`Pact verification failed: ${error.message}`);
  process.exitCode = 1;
}
