import type { Credentials } from '../../application/credentials';
import { Session } from '../../application/session';
import type { CredentialsDto, CurrentUserDto, TokenDto } from './account-api';

// The DTO mapper of the HTTP adapters (classes.md decision 22, view 4.2, #45). It turns the
// values of layer 2 into the DTOs of hexablock-api and the DTOs into values of layer 2, so no
// adapter copies a field by hand. #46, #47 and #48 add the mappings of their resources here.
export class ApiDtoMapper {
  // The body of a sign-up or a sign-in. The sign-in body has the same fields.
  toCredentialsDto(credentials: Credentials): CredentialsDto {
    return { username: credentials.username, password: credentials.password };
  }

  // The session of the token of a sign-in and of the account of that token.
  // A blank token or user id throws the `RangeError` of `Session`.
  toSession(token: TokenDto, user: CurrentUserDto): Session {
    return new Session(token.accessToken, user.userId);
  }
}
