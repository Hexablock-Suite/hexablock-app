# Changelog

All notable changes to this repository are documented in this file. The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

Each sprint of [`docs/ROADMAP.md`](docs/ROADMAP.md) closes with a version section and a `v0.N.0` tag (rule R-sprint-release in `AGENTS.md`). The final delivery is `v1.0.0`.

## [Unreleased]

### Added

- Sprint plan in `docs/ROADMAP.md`, this changelog, rule R-sprint-release and its gate `test/docs/changelog.test.ts`.
- Class diagram in `docs/architecture/classes.md`: the generic engine and the four variants ([#9](https://github.com/Hexablock-Suite/hexablock-app/pull/9)), the five engine views and the four variant views ([#11](https://github.com/Hexablock-Suite/hexablock-app/pull/11)), the engine and variant overview maps ([#12](https://github.com/Hexablock-Suite/hexablock-app/pull/12)), and the use case and adapter maps and views ([#13](https://github.com/Hexablock-Suite/hexablock-app/pull/13)).
- Numbered functional and non-functional requirements, APP-FR-n and APP-NFR-n, each with a check ([#10](https://github.com/Hexablock-Suite/hexablock-app/pull/10)).
- Draft layer diagram in `docs/architecture/layers.md` for review with the professor ([#5](https://github.com/Hexablock-Suite/hexablock-app/pull/5)), with the interfaces the brief names ([#7](https://github.com/Hexablock-Suite/hexablock-app/pull/7)).
- The variations, questions, class diagram request and requirements method from the class of 2026-10-26 in `docs/REQUIREMENTS.md` ([#3](https://github.com/Hexablock-Suite/hexablock-app/pull/3)).
- Project requirements in `docs/REQUIREMENTS.md`, with assumptions and open questions ([#2](https://github.com/Hexablock-Suite/hexablock-app/pull/2)).
- Repository bootstrap ([#1](https://github.com/Hexablock-Suite/hexablock-app/pull/1)): Expo SDK 58 app with one home route, the Clean layer skeleton, the lint, architecture, domain purity and test title gates, commit hooks, `pnpm verify` and the CI `verify` job, the README and AI usage skeletons, API types generated from the backend OpenAPI document, pact verification against `hexablock-api`, and an APK attached to the GitHub Release of each `v*` tag.

### Changed

- Coordinate arithmetic moves into the grid topology of the class diagram ([#14](https://github.com/Hexablock-Suite/hexablock-app/pull/14)).
- The overview maps replace the PlantUML class diagrams ([#12](https://github.com/Hexablock-Suite/hexablock-app/pull/12)).
- The layer diagram is fixed after the draft audit ([#8](https://github.com/Hexablock-Suite/hexablock-app/pull/8)).
- Q11 is closed: the Drizzle schema moves to the backend persistence adapter ([#6](https://github.com/Hexablock-Suite/hexablock-app/pull/6)).
- Team decisions close Q2, Q3, Q5 and Q6 ([#4](https://github.com/Hexablock-Suite/hexablock-app/pull/4)).
