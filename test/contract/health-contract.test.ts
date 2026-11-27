import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { MatchersV3, PactV4 } from '@pact-foundation/pact';

import { ApiLevelRepository } from '../../src/adapters/api/api-level-repository';
import type { HealthApi } from '../../src/adapters/api/health-api';
import type { LevelsApi, LevelsDto } from '../../src/adapters/api/levels-api';
import fit01 from '../../src/adapters/levels/fit/fit-01.json';
import { LevelId } from '../../src/domain/progress/level-id';
import { GameId } from '../../src/domain/shared/game-id';
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
        .withRequest('GET', '/v1/health')
        .willRespondWith(200, (builder) => builder.jsonBody({ status: 'ok' }))
        .executeTest(async (mockServer) => {
          // The client of layer 4 implements the transport interface of layer 3 (decision 22).
          const api: HealthApi = createApiClient(mockServer.url);
          const health = await api.getHealth();

          expect(health).toEqual({ status: 'ok' });
        });

      const written = JSON.parse(readFileSync(pactFile, 'utf8'));
      expect(written.consumer.name).toBe('hexablock-app');
      expect(written.provider.name).toBe('hexablock-api');
      expect(written.interactions).toHaveLength(1);
    });

    // Issue #48: the app reads the stored levels of the backend. The provider state of
    // hexablock-api #151 stores the level `fit-01`, the complete Fit example of the level format,
    // which the bundled file `fit-01.json` holds too.
    it('should_return_the_stored_levels_when_the_backend_holds_a_level', async () => {
      await pact
        .addInteraction()
        .given('a level is stored', { gameId: 'hexa-fit', levelId: 'fit-01' })
        .uponReceiving('the stored levels')
        .withRequest('GET', '/v1/levels')
        .willRespondWith(200, (builder) => builder.jsonBody({ levels: MatchersV3.eachLike(fit01) }))
        .executeTest(async (mockServer) => {
          // The client implements the transport of the levels, and the repository reads it.
          // The transport keeps each answer, so the test reads the body as the backend sends it.
          const client = createApiClient(mockServer.url);
          const answers: LevelsDto[] = [];
          const api: LevelsApi = {
            getLevels: async () => {
              const answer = await client.getLevels();
              answers.push(answer);
              return answer;
            },
          };
          const levels = await new ApiLevelRepository(api).list(GameId.of('hexa-fit'));

          expect(answers).toEqual([{ levels: [fit01] }]);
          expect(levels.map((level) => level.levelId().equals(LevelId.of('fit-01')))).toEqual([
            true,
          ]);
        });

      const written = JSON.parse(readFileSync(pactFile, 'utf8'));
      expect(
        written.interactions.map(({ description }: { description: string }) => description),
      ).toEqual(['a health check', 'the stored levels']);
    });
  });

  describe('provider check script (pnpm contract:verify)', () => {
    let backend: FakeBackend | undefined;

    afterEach(async () => {
      await backend?.close();
      backend = undefined;
    });

    it('should_pass_contract_verify_when_backend_honors_the_pact', async () => {
      backend = await startFakeBackend({
        '/v1/health': { status: 200, body: { status: 'ok' } },
        '/v1/levels': { status: 200, body: { levels: [fit01] } },
      });

      const result = await runNodeScript('scripts/contract/verify-provider.mjs', [], {
        BACKEND_URL: backend.url,
      });

      expect(result.status).toBe(0);
    });

    it('should_fail_contract_verify_when_backend_breaks_the_health_body', async () => {
      backend = await startFakeBackend({
        '/v1/health': { status: 200, body: { status: 'down' } },
        '/v1/levels': { status: 200, body: { levels: [fit01] } },
      });

      const result = await runNodeScript('scripts/contract/verify-provider.mjs', [], {
        BACKEND_URL: backend.url,
      });

      expect(result.status).not.toBe(0);
      expect(result.output).toContain('a health check');
    });
  });
});
