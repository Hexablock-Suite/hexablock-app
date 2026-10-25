import { readFileSync } from 'node:fs';
import path from 'node:path';

import { startFakeBackend, unusedBackendUrl, type FakeBackend } from '../support/fake-backend';
import { repoRoot, runNodeScript } from '../support/run-tool';

const schemaFile = path.join(repoRoot, 'src/infrastructure/api/schema.d.ts');

// An OpenAPI document whose /health response gained a second status value.
const driftedDocument = {
  openapi: '3.0.0',
  info: { title: 'HexaBlock API', version: '0.0.1' },
  paths: {
    '/health': {
      get: {
        operationId: 'HealthController_check',
        responses: {
          '200': {
            description: 'The API process is up.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', enum: ['ok', 'degraded'] } },
                  required: ['status'],
                },
              },
            },
          },
        },
      },
    },
  },
};

const apiCheck = (backendUrl: string) =>
  runNodeScript('scripts/contract/api-types.mjs', ['check'], { BACKEND_URL: backendUrl });

describe('generated API types check (pnpm api:check)', () => {
  let backend: FakeBackend | undefined;

  afterEach(async () => {
    await backend?.close();
    backend = undefined;
  });

  it('should_fail_api_check_when_backend_document_differs_from_committed_types', async () => {
    const before = readFileSync(schemaFile, 'utf8');
    backend = await startFakeBackend({ '/docs-json': { status: 200, body: driftedDocument } });

    const result = await apiCheck(backend.url);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'src/infrastructure/api/schema.d.ts differs from the backend OpenAPI document',
    );
    expect(result.output).toContain('pnpm api:generate');
    expect(readFileSync(schemaFile, 'utf8')).toBe(before);
  });

  it('should_fail_api_check_when_backend_is_unreachable', async () => {
    const before = readFileSync(schemaFile, 'utf8');

    const result = await apiCheck(await unusedBackendUrl());

    expect(result.status).toBe(1);
    expect(result.output).toContain('Cannot read the OpenAPI document');
    expect(readFileSync(schemaFile, 'utf8')).toBe(before);
  });
});
