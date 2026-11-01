# Roadmap

> **Status:** a proposal of 2026-10-31 for team review. Nothing in this plan is agreed until the team approves it in review.

This file is the one place for the HexaBlock Suite sprint plan, for both repositories. `hexablock-api` links here and keeps no copy. Each sprint lists the requirement IDs it delivers and its exit check. The IDs come from [`REQUIREMENTS.md`](REQUIREMENTS.md) (APP-FR-n, APP-NFR-n) and from the backend [`REQUIREMENTS.md`](https://github.com/Hexablock-Suite/hexablock-api/blob/main/docs/REQUIREMENTS.md) (API-FR-n, API-NFR-n). The exit check of a requirement is its _Check_, copied here. When a _Check_ changes in a requirements file, update it here in the same pull request. A path in an API row is a path in `hexablock-api`.

No item has an owner yet. The team assigns the owners in review.

## Why one-week sprints

In class on 2026-10-26 the professor described the plan he expects:

- One-week sprints from now until December (recording 10:16).
- Four or five sprints. The planning decides which user stories come first, which tasks exist and how the team splits them (10:33, 10:41).
- The plan holds a task where the team defines the architecture (11:00). But architecture is not the implementation plan (11:21).

So sprint 0 is the design week, and it holds no code. Sprints 1 to 5 are the five implementation sprints.

## Dates

Every sprint runs from Monday to Sunday. The dates come from the course calendar.

| Date                | What                                                                                       | Sprint |
| ------------------- | ------------------------------------------------------------------------------------------ | ------ |
| 2026-11-16 (Monday) | Second partial exam of the course                                                          | 3      |
| 2026-11-29 (Sunday) | Forum «Clean, Hexagonal y patrones MV», closes at 23:59; each answer uses the project app  | 4      |
| 2026-12-04 (Friday) | Third partial exam of the course                                                           | 5      |
| 2026-12-07 (Monday) | Final project delivery in the class plan (first day); the class plan also names 2026-12-11 | —      |
| 2026-12-14 (Monday) | Project delivery in the course statement, and final grades                                 | —      |

The class plan and the statement give different delivery dates. Q1 in `REQUIREMENTS.md` asks the professor which one is the deadline. Until he answers, we plan against the earliest date, 2026-12-07 (A8). So sprint 5 closes on Sunday 2026-12-06 with the delivery tag `v1.0.0`.

## Releases

- Sprint N closes on its Sunday with the tag `v0.N.0`, the same tag in both repositories. Sprint 0 closes with `v0.0.0`. Sprint 5 closes with `v1.0.0`, the final delivery (APP-NFR-23), instead of `v0.5.0`.
- Before the tag, each repository moves the entries under `## [Unreleased]` in its `CHANGELOG.md` into a new section `## [0.N.0] - YYYY-MM-DD`. Rule R-sprint-release in each `AGENTS.md` holds this step, and a CHANGELOG format test is its gate.
- App: the tag runs `.github/workflows/release-apk.yml`, which builds the APK and attaches it to a GitHub Release (rule R-apk-release). While no game code exists, that APK is the empty skeleton: it installs and opens the home route, and it holds no game.
- Backend: there is no release workflow. The team creates the GitHub Release by hand, with that version's CHANGELOG section as its notes.
- A sprint closes on its date even when an item slips. The item moves to the next sprint, and the CHANGELOG lists only what was merged.

## Order of the sprints

- The generic engine and its tests come before the games: the four variants plug into it (sprints 1 and 2).
- The backend contract comes before app sync: each endpoint is merged, with its OpenAPI document, at least one sprint before the app calls it (sprints 1 to 3, then sprint 4). The app adds the pact interaction when it calls the endpoint.
- Testing, documentation, AOP and AI usage are spread through the sprints, not left for the end. Tests land in every sprint from 1 to 5. A README or `docs/` item lands in sprints 0, 1, 2, 4 and 5. The app aspect and the backend aspect both land in sprint 2. Every pull request adds its AI usage entry.

## Every sprint

These hold in every sprint, and each sprint's exit check includes them:

- `pnpm verify` passes on `main` in both repositories.
- **APP-NFR-22, API-NFR-14 — AI usage.** _Check:_ no gate (rule R-ai-usage-log); each pull request adds its entry.
- **APP-NFR-24 — Integrity.** _Check:_ no gate; the reviewer of each pull request checks the citations.
- The gates that were green before sprint 0 stay green:

| ID         | Exit check                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APP-NFR-14 | Gate `test/gates/test-title-gate.test.ts` (rule R-test-names).                                                                                                               |
| APP-NFR-17 | `pnpm pact:check` passes, and `pacts/` is committed.                                                                                                                         |
| APP-NFR-18 | The `verify` job of `.github/workflows/` runs on every pull request.                                                                                                         |
| APP-NFR-21 | The commit-msg hook and gate `test/gates/commit-message-gate.test.ts` (rule R-conventional-commits).                                                                         |
| API-FR-05  | `pnpm openapi:export` writes `openapi/openapi.json`, and `test/health.e2e-spec.ts` fails when the committed file differs from the code (rule R-openapi-drift).               |
| API-NFR-01 | Gate `test/gates/test-name.gate.spec.ts` (rule R-test-names).                                                                                                                |
| API-NFR-02 | Repository tests run on PGlite through `test/support/test-database.ts`, and gate `test/integration/in-memory-database.spec.ts` covers the harness (rule R-database-harness). |
| API-NFR-04 | The CI `contract` job runs `scripts/contract/verify-provider.js` against the client's pact (rule R-contract).                                                                |
| API-NFR-05 | The CI `verify` job runs on every pull request, and gate `test/gates/ci-contract.spec.ts` keeps it in step with `pnpm verify` (rule R-verify-parity).                        |
| API-NFR-11 | Gate `test/gates/determinism.gate.spec.ts` (rule R-deterministic-core).                                                                                                      |
| API-NFR-13 | `commitlint.config.cjs`, the commit-msg hook and gate `test/gates/commit-message.gate.spec.ts` (rule R-conventional-commits).                                                |

## Sprint 0 — Design week (2026-10-26 to 2026-11-01), tag `v0.0.0`

The design phase: the requirements and the architecture diagrams, with no code. Both repositories number their requirements with a _Check_ each. The architecture diagrams are the layer diagram (E1), the class diagram (E2) and the extensibility diagram (E3). The E2 and E3 updates are in app pull request 15 and backend pull request 9, under team review.

| ID         | Exit check                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| APP-NFR-10 | `pnpm arch` passes, and [`architecture/layers.md`](architecture/layers.md) holds the layer diagram.                                                                                                                |
| API-NFR-08 | `pnpm arch` and gate `test/gates/architecture.gate.spec.ts` (rules R-domain-pure, R-application-pure, R-persistence-no-nest, R-adapters-no-infrastructure); the layer diagram is in `docs/architecture/layers.md`. |

APP-NFR-19 and API-NFR-10 start here with the diagram sources. Sprint 4 finishes them.

## Sprint 1 — Generic engine (2026-11-02 to 2026-11-08), tag `v0.1.0`

The engine and its tests, with no variant yet. The backend serves accounts and one error shape, so later endpoints reuse both.

| ID         | Exit check                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| APP-NFR-03 | `pnpm arch` passes rules `engine-no-variants` and `domain-no-framework`, and the engine test of APP-NFR-13 runs with a fake cell type. |
| APP-NFR-04 | A test swaps each implementation and the engine code does not change.                                                                  |
| APP-NFR-05 | The README section "Generic Engine" lists every bound with its reason.                                                                 |
| APP-NFR-13 | An engine test uses a cell type and a square topology that exist only in the tests (D4).                                               |
| API-FR-01  | An e2e test signs up, signs in and calls a protected endpoint with the token; the same call without a token gets 401.                  |
| API-FR-06  | E2e tests for a validation error, a missing token and a missing resource get the same body shape.                                      |

## Sprint 2 — The four variant rules (2026-11-09 to 2026-11-15), tag `v0.2.0`

Hexa Lines, Hexa Fit, Hexa Sort and Hexa Merge plug into the engine, each with its rules tests. The generic use case and its aspect wrap all four. The backend stores progress per `gameId`. The team settles the scoring of each variant (`REQUIREMENTS.md` §10, "Still to define").

| ID         | Exit check                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APP-NFR-01 | The four variants use the same board class with a different cell type, and no variant has a board class of its own.                                                                           |
| APP-NFR-02 | Each variant's rules class implements the contract, and the engine calls only the contract.                                                                                                   |
| APP-FR-03  | APP-NFR-01 to APP-NFR-03.                                                                                                                                                                     |
| APP-NFR-07 | Gate `test/gates/domain-purity-gate.test.ts` (rule R-domain-determinism in `AGENTS.md`), and a Merge test with a fixed seed always gets the same new tiles.                                   |
| APP-NFR-12 | `pnpm test` runs them in CI, with one test file for the rules of each variant.                                                                                                                |
| APP-NFR-11 | A test shows that one aspect runs for the four variants, and the use case it wraps has no line of the aspect's code.                                                                          |
| APP-NFR-08 | The README section "SOLID Principles" has one example per principle with a link to its file, and the engine has no `if` or `switch` on the game id.                                           |
| APP-FR-06  | The README documents the scoring of each variant.                                                                                                                                             |
| API-FR-02  | An endpoint test saves progress for two variants and reads back two entries; a second save for the same user and variant does not add an entry; a request without `gameId` is rejected.       |
| API-NFR-03 | The e2e suite has one save-and-load test per variant.                                                                                                                                         |
| API-NFR-07 | Gate `test/gates/architecture.gate.spec.ts` keeps Nest out of `src/application` (rule R-application-pure), and a test shows the aspect runs while the use case it wraps has none of its code. |
| API-NFR-06 | The README section "SOLID Principles" has one example per principle with a link to its file.                                                                                                  |

## Sprint 3 — Game flow and local progress (2026-11-16 to 2026-11-22), tag `v0.3.0`

The screens, from home to victory and defeat, in Spanish and English from the first text. Local progress per variant. The first Fit and Sort levels, enough to test the level selector. The backend serves leaderboards and level definitions. The team settles the generic level schema early in the sprint (backend `REQUIREMENTS.md` §4).

| ID         | Exit check                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| APP-FR-01  | A UI test opens each of the four variants from the selector.                                                                        |
| APP-FR-02  | For Fit and Sort, the selector shows which levels are completed, which are open and which are locked.                               |
| APP-FR-04  | The high score of Lines and of Merge is still there after the app restarts.                                                         |
| APP-FR-07  | A UI test reaches both screens and uses their buttons.                                                                              |
| APP-FR-08  | In Fit, undo and then redo give back the same board; in Merge, a second undo in a row changes nothing; Lines and Sort show no undo. |
| APP-FR-09  | APP-NFR-15.                                                                                                                         |
| APP-NFR-15 | One integration test per variant saves progress and loads it back.                                                                  |
| APP-FR-11  | Every visible text has a Spanish and an English entry.                                                                              |
| APP-NFR-16 | A navigation test visits the six screens.                                                                                           |
| API-FR-03  | An endpoint test filters by `gameId` and by level.                                                                                  |
| API-FR-04  | An endpoint test reads the levels of each `gameId`, and the update rejects a Fit level that fails A5.                               |

## Sprint 4 — Backend sync and architecture documents (2026-11-23 to 2026-11-29), tag `v0.4.0`

The app signs in, syncs progress, shows the leaderboards and takes levels from the backend, against the endpoints of sprints 1 to 3. All hand-made levels and the sound. The forum of 2026-11-29 is answered with the project app, so the architecture documents of both repositories are finished in this sprint.

| ID         | Exit check                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| APP-FR-12  | After sign-in, a sync request carries the token.                                                                                                                                                                         |
| APP-FR-13  | Progress saved in the app appears in the backend entry for that user and `gameId`.                                                                                                                                       |
| APP-FR-14  | A UI test shows both leaderboards from a stubbed API.                                                                                                                                                                    |
| APP-FR-15  | With the network off, every bundled level opens.                                                                                                                                                                         |
| APP-FR-05  | A CI test counts the bundled level files and checks every Fit level against A5.                                                                                                                                          |
| APP-FR-10  | The mute option silences both the effects and the music.                                                                                                                                                                 |
| APP-NFR-09 | The README section "Design Patterns" lists each pattern used with its justification and a link to its file, and Strategy and Abstract Factory are in it.                                                                 |
| APP-NFR-19 | The README embeds the three images; [`architecture/layers.md`](architecture/layers.md) and [`architecture/classes.md`](architecture/classes.md) hold two of the sources, and the extensibility diagram is still to draw. |
| API-NFR-09 | The README section "Design Patterns" lists each pattern used with its justification and a link to its file.                                                                                                              |
| API-NFR-10 | `architecture/layers.md` holds the layer diagram; the class diagram and `docs/EXTENSIBILITY.md` are still to write.                                                                                                      |

The _Check_ of APP-NFR-19 and of API-NFR-10 still says that a diagram or a document is to draw or write. App pull request 15 and backend pull request 9 add them. When those pull requests merge, their _Check_ text changes, and this table follows it.

## Sprint 5 — Delivery (2026-11-30 to 2026-12-06), tag `v1.0.0`

The extensibility rehearsal, the README of each repository and the delivery release. The sprint is short on new work, because the third partial exam falls on Friday 2026-12-04.

| ID         | Exit check                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| APP-NFR-06 | Before the defense we apply each of the three example changes on a branch, and the diff touches no engine file. |
| APP-NFR-20 | Gate `test/docs/docs-skeleton.test.ts` (rule R-docs-headings).                                                  |
| API-NFR-12 | Gate `test/gates/docs-skeleton.spec.ts` (rule R-docs-skeleton).                                                 |
| APP-NFR-23 | Pushing a `v*` tag runs `.github/workflows/release-apk.yml`, which attaches the APK to a GitHub Release.        |

The docs-skeleton gates check only the headings. Before `v1.0.0`, the team also replaces every `TODO` in both READMEs and both `AI_USAGE.md` files, including the section "Critical Evaluation".
