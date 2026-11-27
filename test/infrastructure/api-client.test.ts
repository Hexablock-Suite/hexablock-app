import { ApiFailure } from '../../src/adapters/api/api-failure';
import { apiBaseUrl, DEFAULT_API_URL } from '../../src/infrastructure/api/api-url';
import { createApiClient } from '../../src/infrastructure/api/client';
import { fakeFetch, useFakeFetch } from '../support/fake-fetch';

const ADA = { username: 'ada', password: 'correct horse battery' };

// #45: the HTTP client tells a call that got no answer from a call that the backend refused.
// The pact of test/contract/ checks each answer of the backend.
describe('ApiClient', () => {
  it('should_reject_with_an_api_failure_with_no_status_when_the_backend_does_not_answer', async () => {
    const spy = useFakeFetch(fakeFetch({}, true));
    const api = createApiClient('http://backend.test');

    const thrown = await api.signIn(ADA).then(
      () => undefined,
      (error: unknown) => error,
    );
    spy.mockRestore();

    expect(thrown).toBeInstanceOf(ApiFailure);
    expect((thrown as ApiFailure).status).toBeUndefined();
    expect((thrown as ApiFailure).message).toBe('POST /v1/auth/login got no answer.');
  });
});

// #45: the build sets the address of hexablock-api with the variable EXPO_PUBLIC_API_URL.
describe('apiBaseUrl', () => {
  it('should_give_the_configured_address_when_the_build_sets_one', () => {
    expect(apiBaseUrl(' https://api.example.org ')).toBe('https://api.example.org');
  });

  it('should_give_the_local_backend_when_the_build_sets_no_address', () => {
    expect(DEFAULT_API_URL).toBe('http://localhost:3000');
    expect(apiBaseUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(apiBaseUrl('  ')).toBe(DEFAULT_API_URL);
  });
});
