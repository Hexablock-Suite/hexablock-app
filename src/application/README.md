Use cases and ports, generic over the variant. It may import only `src/domain/` and other `src/application/` code.

The aspects of §3.5 live here too. `UseCaseAspect` is the abstract Decorator of `UseCase`, and `LoggingAspect` extends it. The `Logger` port takes a `UseCaseLogEntry`, never a message (decision 37 of the class diagram).
