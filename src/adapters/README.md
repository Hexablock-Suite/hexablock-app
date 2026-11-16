Interface adapters (presenters, view models, mappers, repository implementations). It may import `src/application/` and `src/domain/`.

Today it holds `InMemoryGameRepository`, the adapter of the `GameRepository` port, and `NullGameEventPublisher`, a `GameEventPublisher` that does nothing until `GameEventBus` exists. Each adapter runs the contract suite of its port in `test/support/contracts/`, the same suite as the test fake.
