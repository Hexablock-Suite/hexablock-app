# Changelog

All notable changes to this repository are documented in this file. The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

Each sprint of [`docs/ROADMAP.md`](docs/ROADMAP.md) closes with a version section and a `v0.N.0` tag (rule R-sprint-release in `AGENTS.md`). The final delivery is `v1.0.0`.

## [Unreleased]

### Added

- APP-FR-16 in `docs/REQUIREMENTS.md`: the player chooses the board figure (hexagon, square or triangle) on one generic engine and one generic board, derived from the session of 2026-11-03 ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- A note in `docs/architecture/classes.md` that `UseCase` and `UseCaseAspect` name architecture roles, not game concepts ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- Use case flows 3 to 5 in `docs/architecture/flows.md`: `StartGame`, `UndoMove` and `Login`, each with a class view across the layers and a UML sequence diagram with `alt` and `ref` fragments, and a table that names the path of every other use case ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- Use case flows in `docs/architecture/flows.md`: `ApplyMove` and `SaveProgress`, each with a class view across the four layers and a UML sequence diagram with the same class names ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- Sprint plan in `docs/ROADMAP.md`, this changelog, rule R-sprint-release and its gate `test/docs/changelog.test.ts`.
- Class diagram in `docs/architecture/classes.md`: the generic engine and the four variants ([#9](https://github.com/Hexablock-Suite/hexablock-app/pull/9)), the five engine views and the four variant views ([#11](https://github.com/Hexablock-Suite/hexablock-app/pull/11)), the engine and variant overview maps ([#12](https://github.com/Hexablock-Suite/hexablock-app/pull/12)), and the use case and adapter maps and views ([#13](https://github.com/Hexablock-Suite/hexablock-app/pull/13)).
- Numbered functional and non-functional requirements, APP-FR-n and APP-NFR-n, each with a check ([#10](https://github.com/Hexablock-Suite/hexablock-app/pull/10)).
- Draft layer diagram in `docs/architecture/layers.md` for review with the professor ([#5](https://github.com/Hexablock-Suite/hexablock-app/pull/5)), with the interfaces the brief names ([#7](https://github.com/Hexablock-Suite/hexablock-app/pull/7)).
- The variations, questions, class diagram request and requirements method from the class of 2026-10-26 in `docs/REQUIREMENTS.md` ([#3](https://github.com/Hexablock-Suite/hexablock-app/pull/3)).
- Project requirements in `docs/REQUIREMENTS.md`, with assumptions and open questions ([#2](https://github.com/Hexablock-Suite/hexablock-app/pull/2)).
- Repository bootstrap ([#1](https://github.com/Hexablock-Suite/hexablock-app/pull/1)): Expo SDK 58 app with one home route, the Clean layer skeleton, the lint, architecture, domain purity and test title gates, commit hooks, `pnpm verify` and the CI `verify` job, the README and AI usage skeletons, API types generated from the backend OpenAPI document, pact verification against `hexablock-api`, and an APK attached to the GitHub Release of each `v*` tag.

### Changed

- The engine, use case and adapter maps and extensibility views 1 and 3 draw no line on a dashed frame or a package: each line joins the two classes that depend, with a role and a multiplicity or a verb, and the reading notes say why, after the session of 2026-11-03 ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- The class and extensibility views keep a diamond only where it makes a GoF pattern visible: `Board` with its `BoardShape` and `Piece` with its `ShapeNode` become use arrows, the legends say «in-layer pattern», and the notation texts and decision 23 drop the domain relation exception ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- The use case and adapter maps label the uses between groups with a verb, not with a role and a multiplicity ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- The class diagrams draw use arrows between layers and keep diamonds inside one layer, every use case box shows `execute()`, and `Logger` takes a `UseCaseLogEntry` ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- After the session of 2026-11-03, the use case and adapter maps and extensibility views 1 and 3 join groups only with use arrows, each view legend lists only the line kinds it draws, the layer diagram legend names its dotted arrow a realization, and decision 28 names Clean Architecture ([#63](https://github.com/Hexablock-Suite/hexablock-app/pull/63)).
- Coordinate arithmetic moves into the grid topology of the class diagram ([#14](https://github.com/Hexablock-Suite/hexablock-app/pull/14)).
- The overview maps replace the PlantUML class diagrams ([#12](https://github.com/Hexablock-Suite/hexablock-app/pull/12)).
- The layer diagram is fixed after the draft audit ([#8](https://github.com/Hexablock-Suite/hexablock-app/pull/8)).
- Q11 is closed: the Drizzle schema moves to the backend persistence adapter ([#6](https://github.com/Hexablock-Suite/hexablock-app/pull/6)).
- Team decisions close Q2, Q3, Q5 and Q6 ([#4](https://github.com/Hexablock-Suite/hexablock-app/pull/4)).
