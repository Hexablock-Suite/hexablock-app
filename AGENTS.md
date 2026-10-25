# AGENTS.md

HexaBlock Suite mobile client: four hex-board puzzle games (Hexa Lines, Hexa Fit, Hexa Sort, Hexa Merge) on one generic engine. Expo SDK 58, Expo Router, TypeScript, Node 26, pnpm.

Every rule ends with an HTML comment marker (`rule: R-<id>`) and names its gate: a script, a test path, or "no gate". `test/docs/agents-rules.test.ts` checks the markers.

## Commands

```bash
pnpm install          # dependencies and git hooks
pnpm verify           # lint, format:check, typecheck, test, pact:check, arch (CI runs this)
BACKEND_URL=http://localhost:3000 pnpm contract:verify  # pact against a running backend
BACKEND_URL=http://localhost:3000 pnpm api:check        # generated API types against it
npx expo install <pkg> # add an Expo or React Native package at the SDK version
npx expo-doctor       # check dependency and config health
```

Expo changes every SDK. Read the docs for the installed major version (`https://docs.expo.dev/versions/v58.0.0/`), not memory.

## Layers

`app/` holds Expo Router routes only (framework layer). `src/domain/engine/`, `src/domain/variants/<variant>/`, `src/application/`, `src/adapters/` and `src/infrastructure/` follow Clean Architecture. Each folder README says what it may import.

## Rules

- Run `pnpm verify` before you declare a task done. Gate: `.github/workflows/ci.yml` (job verify). <!-- rule: R-verify -->
- Write code, comments, docs and commit messages in English. Gate: no gate (commitlint checks the format, not the language). <!-- rule: R-english -->
- Commit messages follow Conventional Commits. Gate: `.vite-hooks/commit-msg`, `test/gates/commit-message-gate.test.ts`. <!-- rule: R-conventional-commits -->
- Never bypass a git hook with `--no-verify`. Gate: no gate (CI repeats lint, typecheck and arch, not the hook). <!-- rule: R-no-hook-bypass -->
- Name every `it` and `test` as `should_<expected_result>_when_<condition>`. Gate: `pnpm lint`, `test/gates/test-title-gate.test.ts`. <!-- rule: R-test-names -->
- Domain code imports only domain code, and never React, React Native or Expo. Gate: `pnpm arch`, `test/gates/architecture-gate.test.ts`. <!-- rule: R-domain-imports -->
- The engine never imports a variant, and a variant never imports another variant. Gate: `pnpm arch`, `test/gates/architecture-gate.test.ts`. <!-- rule: R-engine-variants -->
- Application code imports only domain and application code. Gate: `pnpm arch`, `test/gates/architecture-gate.test.ts`. <!-- rule: R-application-imports -->
- Domain code takes time and randomness by injection: no `Math.random`, `Date.now` or `new Date()`. Gate: `pnpm lint`, `test/gates/domain-purity-gate.test.ts`. <!-- rule: R-domain-determinism -->
- Do not edit `src/infrastructure/api/schema.d.ts` by hand: run `pnpm api:generate` against backend `main` and commit it. Commit `pacts/` whenever `pnpm test` rewrites it. Gate: `.github/workflows/ci.yml` (job contract runs `pnpm contract:verify` and `pnpm api:check`), `pnpm pact:check`, `test/gates/ci-contract.test.ts`. <!-- rule: R-api-contract -->
- Keep the required README and AI_USAGE headings. Gate: `test/docs/docs-skeleton.test.ts`. <!-- rule: R-docs-headings -->
- Log AI use per task in `AI_USAGE.md`. Gate: no gate. <!-- rule: R-ai-usage-log -->
- Add Expo and React Native packages with `npx expo install`. Gate: no gate (`npx expo-doctor` runs by hand). <!-- rule: R-expo-install -->
- Do not create or edit `ios/` or `android/` by hand; configure native behavior in `app.json`. Gate: no gate. <!-- rule: R-no-native-folders -->
- Release the APK by pushing a `v*` tag; `.github/workflows/release-apk.yml` builds it from `npx expo prebuild` and attaches it to a GitHub Release. Never commit `android/` or a keystore. Gate: `test/gates/release-apk.test.ts` (it pins the workflow, not a green build). <!-- rule: R-apk-release -->
- Every rule in this file names its gate or says "no gate". Gate: `test/docs/agents-rules.test.ts`. <!-- rule: R-rule-gates -->
