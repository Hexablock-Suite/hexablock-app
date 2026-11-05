# Clean Architecture layers

Status: draft for review with the professor, 2026-10-30. Updated on 2026-10-31 to match the class diagram: one generic input port, the ports of decisions 10 to 12, engine interfaces that are not ports, and the presentation pattern. Updated on 2026-11-02: the `Logger` port takes a log entry, and its adapter writes the text (decision 37 of the class diagram).

This page answers one question: in which layer does each piece of the client live? It follows the statement (§3.4, §4.2) and the layer rules in `.dependency-cruiser.cjs`. The engine is not written yet. Today `src/` holds one README per layer folder plus the API client in `src/infrastructure/api/`. Component names follow the statement (§3.1, §3.4) and the [class diagram](classes.md). They are not final. The engine names carry no geometry: `Board<TCell, TCoord>` is the `HexBoard<TCell>` of §3.1 (decision 16 of the class diagram). IDs such as A1, D3 and Q7 refer to [`docs/REQUIREMENTS.md`](../REQUIREMENTS.md). The classes of layer 1 are in the [class diagram](classes.md).

## Diagram

Statement §4.2 asks for four concentric layers. Mermaid draws them as a stack: layer 4, the outer ring, is at the top, and layer 1, the center, is at the bottom. Every arrow goes from the component that imports to the component it imports. No arrow points up, toward an outer layer. Some arrows stay inside one layer, for example from the presenters to the mappers.

- Solid arrow: uses (imports). Dotted arrow: realization, the class implements an interface. Mermaid draws no hollow triangle, so the dotted line and its label `implements` stand for the UML realization.
- Rounded node: a port, an interface that layer 2 owns and an outer layer implements. Ports live in the application layer, because a use case may depend only on ports of its own layer (§3.4). So only layer 2 has rounded nodes.
- Plain box: a class or an interface that is not a port. The engine owns `Clock`, `RandomSource` and `GameEventPublisher`, and layer 3 owns `KeyValueStore`. An outer layer implements them too, but they are interfaces of their own layer, not ports (decision 25 of the class diagram).
- Dashed border and the suffix "(planned)": the component does not exist yet. A solid border means the file exists today.
- A label that names a question (Q8 or Q9) marks a placement the team has not settled. The box sits where this draft puts it, and the professor's answer can move it.
- Colors: layer 1 yellow, layer 2 purple, layers 3 and 4 blue. The course colors three layers: the domain yellow, the application purple and the infrastructure blue. With four layers, layers 3 and 4 together are the blue infrastructure, so the team draws layer 3 light blue and layer 4 dark blue. The class views use the same colors.
- The legend is a box inside the drawing, below layer 1, so the image carries it too. It repeats the colors, the node shapes and the two arrows.

```mermaid
flowchart TB
  subgraph L4["Layer 4: Frameworks and drivers"]
    subgraph APP["app/"]
      ROUTES["Expo Router routes<br/>_layout.tsx, index.tsx (home)"]
      SCREENS["Game selector, level selector, game,<br/>victory and defeat routes: the MVP views (planned)"]
    end
    subgraph INFRA["src/infrastructure/"]
      API["api/client.ts: createApiClient<br/>api/schema.d.ts: generated OpenAPI types"]
      STORAGE["DeviceKeyValueStore: local storage driver (planned)"]
      APIREPOS["api/: ApiProgressRepository, ApiLevelRepository,<br/>ApiLeaderboardGateway, ApiAccountGateway<br/>and ApiDtoMapper (planned)"]
      SECURE["SessionManager: secure token storage,<br/>single scope (planned)"]
      AUDIO["AudioManager: audio facade over the<br/>sound library, single scope (planned)"]
      CLOCK["SystemClock (planned)"]
      RNG["SeededRandomSource (planned)"]
      LOGGER["ConsoleLogger: writes the log text (planned)"]
      VIEWS["BoardView and cell renderers,<br/>React Native (planned, folder: Q8)"]
      ROOT["Composition root (planned, file: Q9)"]
    end
  end

  subgraph L3["Layer 3: Interface adapters, src/adapters/"]
    PRESENTERS["MVP presenters and view models,<br/>one per screen (planned)"]
    MAPPERS["State mappers per variant: one cell<br/>to one CellView (planned)"]
    EVENTBUS["GameEventBus: delivers game events<br/>to presenters, score and audio (planned)"]
    LOCALREPO["LocalProgressRepository and<br/>LocalSettingsStore (planned)"]
    LEVELREPO["BundledLevelRepository (planned)"]
    RUNSTORE["InMemoryRunningGameStore (planned)"]
    KV["KeyValueStore interface (planned)"]
  end

  subgraph L2["Layer 2: Use cases, src/application/"]
    UC["Generic use cases (planned):<br/>StartGame, ApplyMove, UndoMove, RedoMove,<br/>ListLevels, SaveProgress, SyncLeaderboard,<br/>Register, Login, UpdateSettings"]
    ASPECTS["Aspect decorators over the use cases<br/>(planned): logging, timing, retry,<br/>authorization"]
    MODELS["Request and response models,<br/>Result#lt;T, E#gt; and UseCaseError (planned)"]
    INPORTS(["UseCase#lt;TRequest, TResponse#gt;: one generic<br/>input port, each use case binds it (planned)"])
    PPORT(["ProgressRepository port (planned)"])
    LBPORT(["LeaderboardGateway port (planned)"])
    LVPORT(["LevelRepository port (planned)"])
    RGPORT(["RunningGameStore port (planned)"])
    ACCPORT(["AccountGateway port (planned)"])
    SESSPORT(["SessionStore port (planned)"])
    SETPORT(["SettingsStore port (planned)"])
    LOGPORT(["Logger port: takes a UseCaseLogEntry (planned)"])
  end

  subgraph L1["Layer 1: Entities"]
    subgraph VARIANTS["src/domain/variants/"]
      LINES["hexa-lines (planned)"]
      FIT["hexa-fit (planned)"]
      SORT["hexa-sort (planned)"]
      MERGE["hexa-merge (planned)"]
    end
    subgraph ENGINE["src/domain/engine/"]
      CORE["GameEngine#lt;TCell, TCoord, TMove, TState#gt;, the aggregate root,<br/>Board#lt;TCell, TCoord#gt;, Piece, GridTopology#lt;TCoord#gt;,<br/>BoardBuilder, GeometryFactory with HexGeometry,<br/>HexCoord and HexTopology, GameId (planned)"]
      CONTRACTS["Contracts that a variant implements:<br/>IGameRules#lt;TMove, TState#gt; through BaseGameRules,<br/>IScoringPolicy#lt;TState#gt;, BoardState#lt;TCell, TCoord#gt; (planned)"]
      STRATS["Strategies with engine classes:<br/>IPieceSource#lt;TPiece#gt;: SeededPieceSource, FixedListPieceSource;<br/>IProgressModel: HighScoreProgress, LevelProgress (planned)"]
      CAPS["Capability interfaces IUndoable, IRedoable, ITimed,<br/>IRandomSeeded with their engine classes MoveHistory,<br/>RedoableHistory, LevelTimer, SeededPieceSource;<br/>IMergeable#lt;TCell#gt; (planned)"]
      DPORTS["Clock and RandomSource interfaces (planned)"]
      CMDSTATE["MoveCommand and GamePhase classes (planned)"]
      FACTORY["IVariantFactory: creates the rules, piece source,<br/>scoring, board, progress model, initial state<br/>and history (planned, Q8)"]
      EVPORT["GameEventPublisher interface (planned)"]
    end
  end

  ROUTES --> ROOT
  ROUTES --> PRESENTERS
  SCREENS --> VIEWS
  SCREENS --> PRESENTERS
  VIEWS --> PRESENTERS
  ROOT -->|wires every layer| L3
  STORAGE -.->|implements| KV
  LOGGER -.->|implements| LOGPORT
  CLOCK -.->|implements| DPORTS
  RNG -.->|implements| DPORTS

  PRESENTERS --> MAPPERS
  MAPPERS --> CORE
  APIREPOS --> API
  APIREPOS -.->|implement| PPORT & LBPORT & LVPORT & ACCPORT
  LOCALREPO --> KV
  LOCALREPO -.->|implement| PPORT & SETPORT
  LEVELREPO -.->|implements| LVPORT
  RUNSTORE -.->|implements| RGPORT
  RUNSTORE --> CORE

  ASPECTS -->|wraps| UC
  ASPECTS --> LOGPORT
  ASPECTS --> DPORTS
  UC --> MODELS
  UC --> PPORT
  UC --> LBPORT
  UC --> LVPORT
  UC --> RGPORT
  UC --> ACCPORT
  UC --> SETPORT
  UC --> CORE

  LINES & FIT & SORT & MERGE -.->|implement| CONTRACTS
  LINES & FIT & SORT & MERGE -.->|implement| FACTORY
  LINES & FIT & SORT & MERGE -->|factories pick| STRATS & CAPS
  MERGE -.->|MergeTile implements IMergeable| CAPS
  CORE --> CONTRACTS
  CORE --> STRATS
  CORE --> DPORTS
  CORE --> CAPS
  CORE --> CMDSTATE
  CORE --> EVPORT
  UC --> FACTORY

  PRESENTERS -->|calls| INPORTS
  PRESENTERS --> MODELS
  UC -.->|implements| INPORTS
  ASPECTS -.->|implements| INPORTS
  ASPECTS --> SESSPORT
  UC -->|Login and Register write| SESSPORT
  SECURE -.->|implements| SESSPORT
  EVENTBUS -.->|implements| EVPORT
  PRESENTERS -->|listens| EVENTBUS
  AUDIO -->|listens| EVENTBUS

  subgraph LEGEND["Legend"]
    direction LR
    LGL4["Layer 4: frameworks and drivers"]
    LGL3["Layer 3: interface adapters"]
    LGL2["Layer 2: use cases"]
    LGL1["Layer 1: entities"]
    LGPORT(["Rounded node: a port of layer 2"])
    LGPLAN["Dashed border: planned"]
    LGFROM["Importer"] -->|uses| LGTO["Imported"]
    LGIMPL["Implementation"] -.->|realization: implements| LGIFACE["Interface"]
  end

  %% Invisible links keep the layers stacked from outer to inner, with the legend last.
  KV & MAPPERS & RUNSTORE ~~~ ASPECTS
  PPORT & LBPORT & LVPORT & RGPORT & ACCPORT & SESSPORT & SETPORT & LOGPORT & INPORTS ~~~ CORE & LINES & FIT & SORT & MERGE
  L1 ~~~ LEGEND

  classDef planned stroke-dasharray: 5 5
  class SCREENS,APIREPOS,STORAGE,SECURE,AUDIO,CLOCK,RNG,LOGGER,VIEWS,ROOT planned
  class PRESENTERS,MAPPERS,EVENTBUS,LOCALREPO,LEVELREPO,RUNSTORE,KV planned
  class UC,ASPECTS,MODELS,INPORTS,PPORT,LBPORT,LVPORT,RGPORT,ACCPORT,SESSPORT,SETPORT,LOGPORT planned
  class LINES,FIT,SORT,MERGE,CORE,CONTRACTS,STRATS,CAPS,DPORTS,CMDSTATE,FACTORY,EVPORT planned
  class LGPLAN planned

  style L4 fill:#cfdcf3,stroke:#1e3a8a,color:#111827
  style APP fill:#cfdcf3,stroke:#1e3a8a,color:#111827
  style INFRA fill:#cfdcf3,stroke:#1e3a8a,color:#111827
  style L3 fill:#e2ebf8,stroke:#1d4ed8,color:#111827
  style L2 fill:#efe7f8,stroke:#7e22ce,color:#111827
  style L1 fill:#fef3c7,stroke:#b45309,color:#111827
  style VARIANTS fill:#fde68a,stroke:#b45309,color:#111827
  style ENGINE fill:#fde68a,stroke:#b45309,color:#111827
  style LEGEND fill:#ffffff,stroke:#4b5563,color:#111827
  style LGL4 fill:#cfdcf3,stroke:#1e3a8a,color:#111827
  style LGL3 fill:#e2ebf8,stroke:#1d4ed8,color:#111827
  style LGL2 fill:#efe7f8,stroke:#7e22ce,color:#111827
  style LGL1 fill:#fef3c7,stroke:#b45309,color:#111827
```

## Layers and allowed dependencies

The "May depend on" column repeats `.dependency-cruiser.cjs`. `pnpm arch` checks `src/` and `app/` with it, and `test/gates/architecture-gate.test.ts` tests each rule. Layer 4 has no rule yet, so its column repeats the folder README and says "no rule".

| Layer                     | Folder                           | What lives there                                                                                                                                                                                                                                                                              | May depend on                                                                                                                                                                |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Entities               | `src/domain/engine/`             | The generic engine: `Board<TCell, TCoord>`, `Piece`, `GridTopology<TCoord>` (D4), `BoardBuilder`, the geometry family with `HexCoord` and `HexTopology`, `GameEngine<TCell, TCoord, TMove, TState>` and the contracts it uses. The interfaces for time and randomness (R-domain-determinism). | Only `src/domain/` code. Never a variant, a package or a Node module. Rules: `domain-imports-only-domain`, `domain-no-framework`, `engine-no-variants`.                      |
| 1. Entities               | `src/domain/variants/<variant>/` | One folder per game. Each one holds its cell type, its move, its state, its `IGameRules` implementation, its scoring policy and its factory.                                                                                                                                                  | `src/domain/engine/` and its own folder. Never another variant, a package or a Node module. Rules: `domain-imports-only-domain`, `domain-no-framework`, `variants-isolated`. |
| 2. Use cases              | `src/application/`               | The generic use cases, the ports they need (repositories, gateways, running game, session, settings, logger), the request and response models, `Result` and the aspect decorators.                                                                                                            | Only `src/domain/` and `src/application/` code. No package. Rule: `application-imports-only-domain`.                                                                         |
| 3. Interface adapters     | `src/adapters/`                  | Presenters and view models (MVP), state mappers, the local repositories, the in-memory running game store and the `KeyValueStore` driver interface.                                                                                                                                           | `src/application/`, `src/domain/` and its own folder. Never a driver of `src/infrastructure/`, a package or a Node module. Rule: `adapters-imports-only-inner-layers`.       |
| 4. Frameworks and drivers | `src/infrastructure/`            | The HTTP client, its generated types and the HTTP repositories (Q7 closed); storage, session, audio, system clock, seeded random source, logger.                                                                                                                                              | Every inner layer and any package, per `src/infrastructure/README.md`. No rule.                                                                                              |
| 4. Frameworks and drivers | `app/`                           | Expo Router routes only (`AGENTS.md`).                                                                                                                                                                                                                                                        | Every inner layer and any package. No rule.                                                                                                                                  |

## Where each piece lives

- **Generic engine:** layer 1, `src/domain/engine/`. `Board<TCell, TCoord>`, `GameEngine<TCell, TCoord, TMove, TState>` (D1) and the contracts `IGameRules`, `IPieceSource<TPiece>`, `IScoringPolicy<TState>` and `IProgressModel`. The shared implementations (seeded or fixed piece source, high score or levels with stars) live here too. They take time and randomness through the `Clock` and `RandomSource` interfaces of the engine. `GameEngine` is the aggregate root of a game: a game changes only through `play()`, and `play()` applies a move only while the phase allows it. The scoring policy is the domain service (decision 26). The geometry family (`GeometryFactory` with `HexGeometry`) creates the coordinate, the topology and the piece shapes, and `BoardBuilder` builds the board from them. The abstract `BaseGameRules` holds the turn skeleton as a template method.
- **The four variants:** layer 1, `src/domain/variants/hexa-lines/`, `hexa-fit/`, `hexa-sort/` and `hexa-merge/`. Each one extends `BaseGameRules` for its own cell type, for example `MergeTile` for Hexa Merge (A1), and writes its scoring policy, its state and its factory. It writes no piece source, progress model or capability class: those live in the engine, and the variant factory picks them (decision 3). A variant imports the engine. The engine never imports a variant.
- **Abstract Factory per variant:** layer 1. The interface `IVariantFactory` lives in `src/domain/engine/`, and each variant folder holds one implementation. It creates the whole family of statement §3.3: the rules, the piece source (`createPieceSource()`), the scoring policy and the board (`createBoard()`, with `BoardBuilder`), plus the progress model, the initial state and the optional history (decision 31). `StartGame` receives a factory and never names a variant. The cell renderer that D3 assigns to this factory cannot live here. Q8 asks where the renderer goes, and its answer can move the factory too.
- **Capability interfaces:** layer 1, `src/domain/engine/`. `IMergeable<TCell>` is the bound on the Hexa Merge cell (§3.1). `IUndoable`, `ITimed` and `IRandomSeeded` stay separate (§3.2, ISP). The engine classes `MoveHistory`, `RedoableHistory`, `LevelTimer` and `SeededPieceSource` implement them, and the variant factory gives a game only the ones it uses, so Hexa Lines gets no `IUndoable` (decision 3). `GameEngine.undoable()` and `redoable()` return the capability or `undefined`, so no use case asks for a concrete class (decision 27). `IRedoable` is our addition: Hexa Fit redoes, and Hexa Merge only undoes (§5.1.8).
- **Command and State:** layer 1, `src/domain/engine/`. `MoveCommand` wraps each move, so the history supports undo and redo: unlimited in Hexa Fit, one move in Hexa Merge (§3.3). `GamePhase` has one class per phase of a game: Playing, Resolving, Paused, GameOver and Victory (§3.3). The name avoids a clash with the `TState` type parameter. The menu belongs to the presentation layer, not to `GamePhase` (D2).
- **Game events (Observer):** the `GameEventPublisher` interface lives in layer 1, `src/domain/engine/`, because the engine notifies at the end of each turn. It is an engine interface, not a port. It publishes events such as `LineCleared`, `StackMerged`, `TileMerged` and `GameOver` (§3.3). `GameEventBus` in layer 3 implements it. The presenters, the score display and `AudioManager`, the audio facade in layer 4, listen to it, so the engine never knows about sound or screens.
- **Use cases:** layer 2, `src/application/`. One generic set for the four variants:
  - `StartGame`, `ApplyMove`, `UndoMove`, `SaveProgress` and `SyncLeaderboard`. The game use cases keep the running engine through the `RunningGameStore` port, and `InMemoryRunningGameStore` in layer 3 implements it (decision 10).
  - `RedoMove`: redo in Hexa Fit (statement §5.1.8).
  - `ListLevels`: the level selector with its progress indicator and locked levels (§5.1.2).
  - `Register` and `Login`: sign-up and sign-in against the backend (§5.2.1), through the `AccountGateway` port, which `ApiAccountGateway` in layer 4 implements (decision 11). They write the token through the `SessionStore` port.
  - `UpdateSettings`: the mute option and the language (§5.1.10, §5.1.11), through the `SettingsStore` port, which `LocalSettingsStore` in layer 3 implements over `KeyValueStore` (decision 12).
- **Input port:** layer 2, `src/application/`, one generic interface, `UseCase<TRequest, TResponse>` (decision 9). Each use case binds it, for example `UseCase<ApplyMoveRequest<TMove>, MoveResult<TCell, TCoord>>`. The presenters depend on the interface, not on the class. Each aspect decorator implements the same interface to wrap any use case. Tests call the same interface.
- **Results and response models:** layer 2. `execute()` returns `Promise<Result<TResponse>>`: a use case reports a failure as a `Result` with a `UseCaseError` and never throws to the screen (decision 28). The response is plain data: `MoveResult` copies the cells and never carries the `Board` or the engine (decision 29).
- **Session:** the `SessionStore` port lives in layer 2. `SessionManager`, the secure token storage in layer 4, implements it. `Login` and `Register` write the token through it. The authorization aspect reads it before `SaveProgress` and `SyncLeaderboard` run (§3.5).
- **AOP decorators:** layer 2, `src/application/`. Each decorator implements the same use case interface and wraps a use case (§3.5, A2). `RetryAspect` runs the use case again while the error of its `Result` is retryable. A decorator logs through the `Logger` port and reads the time through the `Clock` interface of the engine, because `application-imports-only-domain` forbids a logging package there. The lint rule of R-domain-determinism covers `src/application/` too, so a decorator never calls `Date.now`. The decorator passes a `UseCaseLogEntry` with the use case name, the outcome, the time and the error, never a prebuilt message. The concrete logger lives in layer 4 and writes the text (decision 37 of the class diagram).
- **Repositories:** the ports (`ProgressRepository`, `LeaderboardGateway`, `LevelRepository`) live in layer 2. The local implementations live in layer 3, `src/adapters/`, and use `KeyValueStore`, a driver interface of layer 3. The HTTP implementations and their DTO mapper live in layer 4, `src/infrastructure/api/`, next to the HTTP client, and implement the layer 2 ports directly (Q7, option B). No port names a transport type. A new database or backend means a new adapter, and the use cases do not change.
- **API client:** layer 4, `src/infrastructure/api/client.ts`. It uses the types in `schema.d.ts`, which `pnpm api:generate` writes from the backend OpenAPI document. `pacts/hexablock-app-hexablock-api.json` is the contract the consumer test writes for this client. It is a test artifact, not a layer.
- **Screens:** layer 4, `app/` (Expo Router routes; only the home screen exists). Their presenters and view models live in layer 3. The folder for the React Native board and cell components is open (Q8).
- **Presentation pattern: Model-View-Presenter (MVP).** MVP is a presentation pattern, so it works inside Clean Architecture and orders only layers 3 and 4. The view is a route in layer 4, for example `GameScreen` with `BoardView`: it shows a `GameViewModel` and forwards each input to its presenter. The presenter (`GamePresenter`) and the view model live in layer 3: the presenter calls a use case through `UseCase`, maps the plain response to the view model and gives it to the view. The view model is plain data that the presenter builds, not an object that the view binds to, so the pattern is MVP and not MVVM. The model is layers 1 and 2.
- **Dependency-injection composition root:** layer 4. It builds the adapters, injects them into the use cases and wraps the use cases in the aspect decorators. It creates `AudioManager` and `SessionManager` once, so they have a single scope (§3.3). Its file is open (Q9).

## Open questions for the professor

The numbers match the question list in [`docs/REQUIREMENTS.md`](../REQUIREMENTS.md) §11.

- **Q7. Where does the backend repository live?** Closed by the team on 2026-10-30 with option B. `ApiProgressRepository` needs the HTTP client and its generated DTO types, and both live in `src/infrastructure/api/`. Option A kept the repository in `src/adapters/` behind a `BackendApi` port that layer 3 owned. Option B moves the repository and its DTO mapper to `src/infrastructure/api/`, where they implement the layer 2 port directly. The methods of `BackendApi` named transport types, for example `signIn(body: CredentialsDto): Promise<SessionDto>`. In class on 2026-10-30 the professor called this structural coupling: a port that names transport types ties the use cases to the shape of the HTTP data. The diagram shows option B.
- **Q8. Where do the variant factory and the cell renderer live?** D3 says the variant factory provides the cell renderer. A cell renderer is a React Native component, and `domain-no-framework` forbids React in `src/domain/`. Option A: the domain factory builds only domain objects, and a second factory per variant in an outer layer builds the renderer. Option B: the whole factory moves to an outer layer. Which layer should hold the React Native board and cell components: layer 3 next to the presenters, or layer 4?
- **Q9. Where does the composition root live?** It imports every layer, so it belongs in layer 4. Option A: `app/_layout.tsx`, the Expo Router root. Option B: a module in `src/infrastructure/` that `app/_layout.tsx` calls, so `app/` keeps routes only. Which one do you expect?
