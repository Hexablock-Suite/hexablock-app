# HexaBlock Suite — Mobile App

## Project Title & Badges

TODO: add the CI status badge once the GitHub organization exists.

## Description

TODO: describe the four hex-board puzzle games (Hexa Lines, Hexa Fit, Hexa Sort, Hexa Merge) on one generic engine.

## Demo / Screenshots

TODO: add screenshots or a short video of each variant.

## Architecture

TODO: add the Clean Architecture diagram (image plus editable source) and explain the layers in `src/` and `app/`.

## Generic Engine

TODO: explain the generic types (board, rules, engine) and how each variant instantiates them.

## Design Patterns

TODO: list each GoF pattern, where it lives and why.

## SOLID Principles

TODO: give one concrete example per principle from this codebase.

## AOP

TODO: explain the decorator or proxy strategy over the use cases (logging, timing).

## Getting Started

Requirements: Node 26 (see `.node-version`), pnpm 11 (pinned in `package.json`), and Expo Go on a phone.

```bash
corepack enable pnpm
pnpm install          # also installs the git hooks (prepare script)
pnpm start            # Expo dev server; scan the QR code with Expo Go
pnpm android          # open on an Android emulator or device
pnpm web              # open in the browser
```

The API client in `src/infrastructure/api/` uses types generated from the backend OpenAPI document. With [hexablock-api](https://github.com/Hexablock-Suite/hexablock-api) running, refresh them and commit the result:

```bash
pnpm api:generate     # reads $BACKEND_URL/docs-json (default http://localhost:3000)
```

Check the git hooks with `pnpm exec vp hooks status`. When a global `core.hooksPath` blocks the install, run `GIT_CONFIG_GLOBAL=/dev/null pnpm exec vp hooks enable`.

## Running Tests

```bash
pnpm test             # Jest 30 with jest-expo
pnpm test test/gates  # only the gate tests (lint, architecture, commit message)
pnpm lint             # Oxlint through Vite+
pnpm format:check     # Oxfmt through Vite+
pnpm typecheck        # tsc --noEmit
pnpm arch             # dependency-cruiser layer rules
pnpm pact:check       # fails when pnpm test rewrote a pact file that is not committed
pnpm verify           # lint, format:check, typecheck, test, pact:check, arch; CI job verify
```

Contract tests ([Pact](https://docs.pact.io/)) run inside `pnpm test`. The consumer test calls the real API client against a Pact mock server and writes `pacts/hexablock-app-hexablock-api.json`, which is committed. The backend CI verifies that file from this repository's `main`. Against a running backend:

```bash
export BACKEND_URL=http://localhost:3000
pnpm contract:verify  # the backend honors the committed pact
pnpm api:check        # src/infrastructure/api/schema.d.ts matches the backend OpenAPI document
```

The CI job `contract` builds and starts hexablock-api `main`, then runs both commands.

Test titles follow `should_<expected_result>_when_<condition>`. The linter rejects other `it` and `test` titles.

## AI Usage Documentation

TODO: summarize AI tool use here; the full log lives in [AI_USAGE.md](AI_USAGE.md).

## Contributing

TODO: confirm the team flow below once the repository is on GitHub.

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) in English; the `commit-msg` hook runs commitlint.
- Branch from `main` as `<type>/<short-topic>`, for example `feat/hex-board`.
- Open a pull request to `main`; the `verify` CI job must pass and one teammate must approve before merge.

## License

MIT. See [LICENSE](LICENSE).
