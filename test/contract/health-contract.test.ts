import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { PactV4 } from '@pact-foundation/pact';

import { createApiClient } from '../../src/infrastructure/api/client';
import { startFakeBackend, type FakeBackend } from '../support/fake-backend';
import { repoRoot, runNodeScript } from '../support/run-tool';

const pactFile = path.join(repoRoot, 'pacts/hexablock-app-hexablock-api.json');

const pact = new PactV4({
  consumer: 'hexablock-app',
  provider: 'hexablock-api',
  dir: path.join(repoRoot, 'pacts'),
  logLevel: 'warn',
});

// Jest runs the tests of one file in order. The consumer test writes the pact file first.
// The provider checks below then read it, so no other test file races the write.
describe('health contract', () => {
  describe('consumer', () => {
    // Pact merges new interactions into an existing file and never drops old ones.
    // Removing the file first makes each run write exactly the interactions below.
    // Keep every hexablock-api interaction in this file, or a later file would drop them.
    beforeAll(() => {
      rmSync(pactFile, { force: true });
    });

    it('should_return_status_ok_when_backend_health_answers_200', async () => {
      await pact
        .addInteraction()
        .uponReceiving('a health check')
        .withRequest('GET', '/health')
        .willRespondWith(200, (builder) => builder.jsonBody({ status: 'ok' }))
        .executeTest(async (mockServer) => {
          const health = await createApiClient(mockServer.url).getHealth();

          expect(health).toEqual({ status: 'ok' });
        });

      const written = JSON.parse(readFileSync(pactFile, 'utf8'));
      expect(written.consumer.name).toBe('hexablock-app');
      expect(written.provider.name).toBe('hexablock-api');
      expect(written.interactions).toHaveLength(1);
    });
  });

  describe('provider check script (pnpm contract:verify)', () => {
    let backend: FakeBackend | undefined;

    afterEach(async () => {
      await backend?.close();
      backend = undefined;
    });

    it('should_pass_contract_verify_when_backend_honors_the_pact', async () => {
      backend = await startFakeBackend({ '/health': { status: 200, body: { status: 'ok' } } });

      const result = await runNodeScript('scripts/contract/verify-provider.mjs', [], {
        BACKEND_URL: backend.url,
      });

      expect(result.status).toBe(0);
    });

    it('should_fail_contract_verify_when_backend_breaks_the_health_body', async () => {
      backend = await startFakeBackend({ '/health': { status: 200, body: { status: 'down' } } });

      const result = await runNodeScript('scripts/contract/verify-provider.mjs', [], {
        BACKEND_URL: backend.url,
      });

      expect(result.status).not.toBe(0);
      expect(result.output).toContain('a health check');
    });
  });
});
