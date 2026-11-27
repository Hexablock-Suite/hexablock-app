import type { components } from './dto';

// The sign-up body of hexablock-api, as its OpenAPI document declares it.
export type CredentialsDto = components['schemas']['CredentialsDto'];
// The sign-in body. It has the same fields as the sign-up body.
export type LoginDto = components['schemas']['LoginDto'];
// The answer of a sign-in: the bearer token of the account.
export type TokenDto = components['schemas']['TokenDto'];
// The answer of `GET /v1/auth/me`: the id of the account of the bearer token.
export type CurrentUserDto = components['schemas']['CurrentUserDto'];

// The transport interface of the auth resource (layers.md, classes.md decision 22, option A3, #45).
// Layer 3 owns it, and `createApiClient()` of layer 4 implements it.
// It is not a port: layer 2 does not own it.
// Its methods take and give the DTO types of `dto.d.ts`, never a type of the HTTP library.
// A call that the backend does not answer with success rejects with an `ApiFailure`.
export interface AccountApi {
  // Creates an account. The backend answers 201 with no body.
  signUp(body: CredentialsDto): Promise<void>;
  // Gives the bearer token of the account.
  signIn(body: LoginDto): Promise<TokenDto>;
  // Gives the account of the bearer token `token`. The request sends the token.
  currentUser(token: string): Promise<CurrentUserDto>;
}
