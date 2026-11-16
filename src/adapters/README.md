Interface adapters (presenters, view models, mappers, repository implementations). It may import `src/application/` and `src/domain/`.

Today it holds `InMemoryGameRepository`, the adapter of the `GameRepository` port, and `NullGameEventPublisher`, a `GameEventPublisher` that does nothing until `GameEventBus` exists. Each adapter runs the contract suite of its port in `test/support/contracts/`, the same suite as the test fake.

`HomePresenter` is the MVP presenter of the home screen and of the game selector map (#169). It takes the ids of the registered games and the texts of one language, and it imports no React. It finds the texts of each game under `game.<id>.name` and `game.<id>.place` in the catalog.

It also holds the typed text catalog in `texts/` (APP-FR-11, issue #154). `es.ts` and `en.ts` hold one Spanish and one English entry for each key, and `text-catalog.ts` joins them. A screen shows a text through its key, never through a literal text (rule R-text-catalog in `AGENTS.md`).
