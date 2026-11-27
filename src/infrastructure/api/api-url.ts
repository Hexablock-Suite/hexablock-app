// The address of hexablock-api when the build sets none: the local backend of `AGENTS.md`.
export const DEFAULT_API_URL = 'http://localhost:3000';

// The base address of hexablock-api for the HTTP client (APP-FR-12, #45).
// The build reads it from the variable `EXPO_PUBLIC_API_URL`. Expo writes the value of a variable
// with the prefix `EXPO_PUBLIC_` into the bundle when it builds the app, so a new address needs
// a new build. An unset or blank value gives `DEFAULT_API_URL`.
// Expo replaces only the full name `process.env.EXPO_PUBLIC_API_URL`, so the default value of the
// parameter writes it in full.
export function apiBaseUrl(
  configured: string | undefined = process.env.EXPO_PUBLIC_API_URL,
): string {
  const address = configured?.trim() ?? '';
  return address === '' ? DEFAULT_API_URL : address;
}
