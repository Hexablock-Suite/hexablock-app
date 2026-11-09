Use cases and ports, generic over the variant. It may import only `src/domain/` and other `src/application/` code, and never `src/domain/variants/`.

The aspects of §3.5 live here too. `UseCaseAspect` is the abstract Decorator of `UseCase`, and `LoggingAspect` extends it. The `Logger` port takes a `UseCaseLogEntry`, never a message (decision 37 of the class diagram).

`execute()` never throws (decision 28). An aspect puts its concern in `around()` and calls `super.around()` to run the inner use case. `UseCaseAspect.execute()` turns every exception, from the inner use case or from the aspect's own work, into a failed `Result` with the code `unexpected-failure`, and the `UseCaseError` keeps the exception as its `cause`. `UseCaseError` rejects an empty or blank `code`, and `LoggingAspect` an empty or blank `name`, with a `RangeError`.

The failure codes: `start-failed` (`StartGame`), `no-running-game`, `move-rejected` and `move-failed` (`ApplyMove`), and `unexpected-failure` (`UseCaseAspect`). `ApplyMove` answers success with the saved turn when the event publisher throws after the engine saves it, and passes a `publish-failed` entry to its `Logger` (decision 29). A `Logger` that throws there does not change that answer.
