# Use case flows

Status: draft for team review, 2026-11-04.

This page shows how one use case crosses the four Clean layers of the client. In the class of 2026-11-03 the professor asked to see a pair of use cases and how the layers interact in each. He also wanted to see how the product talks to the backend. So this page has one flow for each path that shows something new: `ApplyMove` stays inside the app, `SaveProgress` sends a result to `hexablock-api`, `StartGame` wires a variant from its factory, `UndoMove` runs the Command history, and `Login` signs in against the backend and keeps the session. The other use cases follow one of these paths, and the table [Other use cases](#other-use-cases) names it. Each flow has two views with the same class names:

- A class view of the use case only. It draws every class of the slice, from the screen to the engine, in the layer bands of parts 3 and 4 of [classes.md](classes.md).
- A UML sequence diagram. It shows the calls in time order, from the screen to the inner layers and back.

The layers themselves are in [layers.md](layers.md). The full class diagram is in [classes.md](classes.md).

## Use case 1: apply a move

`ApplyMove` (APP-FR-03) plays one move. The player taps a cell on `GameScreen`. `GamePresenter` calls the `UseCase` port, and `ApplyMove` takes the running `GameEngine` through the `RunningGameStore` port. The engine plays the turn with its `IGameRules` strategy. `ApplyMove` copies the cells of `Board` and the `payload` of `BoardState.view()` into a plain `MoveResult`, and the presenter maps each cell and the payload with its `StateMapper` into `GameViewModel`. No HTTP call runs.

View 3.2 of [classes.md](classes.md) shows `ApplyMove` with layers 2 and 1 only, and view 4.1 shows the presenter without the use case. So this view joins both slices and does not repeat either view.

### Class view

![ApplyMove class view: GameScreen in layer 4; GamePresenter, StateMapper, GameViewModel and InMemoryRunningGameStore in layer 3; UseCase, ApplyMove, ApplyMoveRequest, MoveResult and the RunningGameStore port in layer 2; GameEngine, IGameRules and Board in layer 1](classes/views/flow-1-apply-move.png)

### Sequence diagram

![ApplyMove sequence: GameScreen calls onMove() on GamePresenter, which calls execute() on ApplyMove; ApplyMove takes the GameEngine from InMemoryRunningGameStore, calls tryPlay(), snapshot(), cells(), undoable() and redoable(), and returns a Result with a MoveResult; GamePresenter maps each cell with StateMapper and builds GameViewModel](flows/views/seq-1-apply-move.png)

## Use case 2: save progress

`SaveProgress` (APP-FR-09, APP-FR-13) saves the result of a finished game. `VictoryScreen` gives the `GameResult` to `ResultPresenter`, which calls the `UseCase` port. `SaveProgress` asks its `IProgressModel` strategy for the `ProgressRecord` and saves it through the `ProgressRepository` port. `ApiProgressRepository` in layer 4 implements that port: `ApiDtoMapper` makes a `ProgressDto`, and `ApiClient` sends it to `ProgressController.sync()` of `hexablock-api` (API-FR-02). The response comes back as a `Result` to the screen.

This flow takes `SaveProgress` and not `SyncLeaderboard`, for two reasons:

- APP-FR-13 says that the app sends its local progress to the backend, and `SaveProgress` serves it. View 4.2 shows the HTTP path of its port: `ApiProgressRepository` keeps `ApiClient` and `ApiDtoMapper.toProgressDto()`.
- No view gives `ApiLeaderboardGateway` a member, and no view says what `SyncLeaderboard` does with its `ProgressRepository`. A sequence diagram of it would invent its steps.

The same endpoint is use case 1 of the API flows, in `hexablock-api/docs/architecture/flows.md`.

### Class view

![SaveProgress class view: VictoryScreen, ApiProgressRepository, ApiDtoMapper and ApiClient in layer 4; ResultPresenter in layer 3; UseCase, SaveProgress and the ProgressRepository port in layer 2; IProgressModel, GameResult and ProgressRecord in layer 1](classes/views/flow-2-save-progress.png)

### Sequence diagram

![SaveProgress sequence: VictoryScreen calls onFinish() on ResultPresenter, which calls execute() on SaveProgress; SaveProgress calls record() on IProgressModel and save() on ApiProgressRepository, which calls toProgressDto() on ApiDtoMapper and syncProgress() on ApiClient; ApiClient sends the HTTP call to ProgressController.sync() of hexablock-api, and the replies go back to the screen](flows/views/seq-2-save-progress.png)

## Use case 3: start a game

`StartGame` (APP-FR-01, APP-FR-03) opens a new game of the chosen variant. The player opens a game on `GameScreen`. `GamePresenter` calls the `UseCase` port, and `StartGame` asks its `IVariantFactory` for the rules, the scoring, the history and the first state. For an endless game, `LinesFactory` builds the board with `BoardBuilder`, and `BoardBuilder` asks its `GeometryFactory` for the topology. For a level game, a level builder asks `BoardBuilder` for the board. `StartGame` creates `GameEngine`, starts it, keeps it in `RunningGameStore` and returns a `MoveResult`. No HTTP call runs.

Why this use case: it is the only path that builds a game. It shows the Abstract Factory of the variant, the Builder of the board and the geometry family in one call. So it shows why no class exists per game and figure (D11): the variant comes from the factory that the composition root injects, and the figure comes from the `GeometryFactory` that the factory and the builder keep.

### Class view

![StartGame class view: GameScreen in layer 4; GamePresenter and InMemoryRunningGameStore in layer 3; UseCase, StartGame, StartGameRequest, MoveResult and the RunningGameStore port in layer 2; IVariantFactory, LinesFactory, BoardBuilder, GeometryFactory, GameEngine and Board in layer 1](classes/views/flow-3-start-game.png)

### Sequence diagram

![StartGame sequence: GameScreen calls onStart() on GamePresenter, which calls execute() on StartGame; StartGame calls createRules(), createScoring(), createHistory() and createInitialState() on IVariantFactory; an alt fragment shows BoardBuilder with GeometryFactory for an endless game and a ref to the level builder for a level game; StartGame creates and starts GameEngine, calls replace() on InMemoryRunningGameStore, reads the snapshot and the cells of Board, and returns a Result with a MoveResult](flows/views/seq-3-start-game.png)

## Use case 4: undo a move

`UndoMove` (APP-FR-08) takes back the last move. The player taps undo on `GameScreen`. `GamePresenter` calls the `UseCase` port, and `UndoMove` takes the running `GameEngine` through the `RunningGameStore` port. It asks the engine for its `IUndoable` capability. When the variant has no history, the answer is `undefined` and `UndoMove` returns a failed `Result`. Otherwise `MoveHistory`, which implements `IUndoable`, undoes its last `MoveCommand`, and the command gives its `before` state back to the engine through the private `GameEngine.restore()`. `UndoMove` then builds the `MoveResult` as `ApplyMove` does. No HTTP call runs.

Why this use case: it is the only path through the Command pattern and the capabilities of §3.2. `UndoMove` never names `MoveHistory`: it asks `GameEngine.undoable()` for the capability (decision 27), so Hexa Lines needs no undo code (ISP). `MoveCommand.before` is the Memento of decision 34.

### Class view

![UndoMove class view: GameScreen in layer 4; GamePresenter and InMemoryRunningGameStore in layer 3; UseCase, UndoMove, MoveResult and the RunningGameStore port in layer 2; GameEngine, IUndoable, MoveHistory, MoveCommand and Board in layer 1](classes/views/flow-4-undo-move.png)

### Sequence diagram

![UndoMove sequence: GameScreen calls onUndo() on GamePresenter, which calls execute() on UndoMove; UndoMove calls current() on InMemoryRunningGameStore and undoable() on GameEngine; an alt fragment returns Result.failure(error) when undoable() is undefined, and otherwise calls undo() on MoveHistory, which calls undo() on MoveCommand, which calls restore() on GameEngine, then reads snapshot(), the cells of Board, canUndo() and redoable(), and returns a Result with a MoveResult](flows/views/seq-4-undo-move.png)

## Use case 5: sign in

`Login` (APP-FR-12) signs the player in. The player sends the credentials on `AccountScreen`. `AccountPresenter` calls the `UseCase` port, and `Login` calls the `AccountGateway` port. `ApiAccountGateway` in layer 4 implements that port: `ApiDtoMapper` makes a `CredentialsDto`, and `ApiClient` sends it to `AuthController.signIn()` of `hexablock-api` (API-FR-01). On success, `ApiDtoMapper` turns the `TokenDto` into a `Session`, and `Login` writes it through the `SessionStore` port, which `SessionManager` implements. On a rejected sign-in, `Login` returns a failed `Result`.

Why this use case: it is the second path to the backend, and the only one that writes the session that `AuthorizationAspect` reads before `SaveProgress` and `SyncLeaderboard` run (view 3.1). It also shows a use case that touches no entity: the view has no layer 1 band. `SessionManager` is the single-scope driver of decision 18.

The same endpoint is use case 2 of the API flows, in `hexablock-api/docs/architecture/flows.md`.

### Class view

![Login class view: SessionManager, ApiDtoMapper, ApiClient, AccountScreen and ApiAccountGateway in layer 4; AccountPresenter in layer 3; UseCase, Login, Credentials, Session and the SessionStore and AccountGateway ports in layer 2](classes/views/flow-5-login.png)

### Sequence diagram

![Login sequence: AccountScreen calls onLogin() on AccountPresenter, which calls execute() on Login; Login calls login() on ApiAccountGateway, which calls toCredentialsDto() on ApiDtoMapper and signIn() on ApiClient; ApiClient sends the HTTP call to AuthController.signIn() of hexablock-api; an alt fragment shows the 200 path, where toSession() makes the Session and Login calls write() on SessionManager, and the 401 path, where Login returns Result.failure(error)](flows/views/seq-5-login.png)

## Other use cases

Each other use case follows the path of one flow above. Its own classes are in the views of Part 3 and Part 4 of [classes.md](classes.md).

| Use case          | Path                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RedoMove`        | Same path as flow 4, except that it asks `GameEngine.redoable()` for the `IRedoable` capability and calls `redo()`. Only Hexa Fit has it: `RedoableHistory` takes back an undone `MoveCommand`.                                       |
| `ListLevels`      | Same path as flow 2, except that it reads and does not write: it calls `LevelRepository.list()` and `ProgressRepository.load()` and returns `LevelSummary` values. Bundled levels come from `BundledLevelRepository` in layer 3 (A6). |
| `SyncLeaderboard` | Same path as flow 2, except that it goes through the `LeaderboardGateway` port and `ApiLeaderboardGateway`. No view gives `ApiLeaderboardGateway` a member yet.                                                                       |
| `Register`        | Same path as flow 5, except that it calls `AccountGateway.register()`, and the HTTP call goes to `AuthController.signUp()`.                                                                                                           |
| `UpdateSettings`  | Same path as flow 5 up to the port, except that it stays in the app: `LocalSettingsStore` in layer 3 implements the `SettingsStore` port over `KeyValueStore`. No HTTP call runs.                                                     |

## How to read the class views

- The zones are the Clean layers, with the colors of [layers.md](layers.md): dark blue for layer 4, light blue for layer 3, purple for layer 2 and yellow for layer 1. The outer layer is at the top, so every dependency between layers points down.
- The lines follow the notation of [classes.md](classes.md). A use arrow joins two layers. A realization joins an adapter to its port, a use case to `UseCase`, or an engine class to the interface it implements, such as `MoveHistory` to `IUndoable`. A diamond stays inside one layer and only where it makes a GoF pattern visible (decision 23): `GamePresenter` keeps its `StateMapper` strategy, `GameEngine` keeps its `IGameRules` strategy, `LinesFactory` and `BoardBuilder` keep the `GeometryFactory` they receive (Abstract Factory), and `GameEngine` keeps its `MoveHistory`, which keeps its `MoveCommand` objects (Command).
- No line starts or ends on a dashed frame. A dashed box with an eyebrow, such as `Credentials` with `PART 3 · MAP`, is a class that another view details. A line may end on it, because it is one class.
- The views draw the input port `UseCase` as an interface box, not as a lollipop. A box lets the presenter point at the port it holds.
- The teal class is the focal class: the use case.
- A flow view shows more than the seven classes of the other views, because it follows one call through every layer.
- Each legend lists only the line kinds that its view draws.

## How to read the sequence diagrams

- Time runs down. Each lifeline is one object of a class of the class view. Its header names the object, its class and its layer, in the color of that layer.
- A solid line with a filled arrowhead is a call. Its label is the operation of the class view with its arguments. A dashed line with an open arrowhead is a return, with the returned value.
- A white bar on a lifeline is an activation: the object runs.
- A call through a port goes to the adapter that runs. The header says which port the adapter implements, for example `implements RunningGameStore`. The caller holds only the port, and the composition root binds the port to the adapter. So the call can go out to an outer layer while the dependency still points down.
- A `loop` fragment repeats its calls. Its guard, in square brackets, says what it repeats over.
- An `alt` fragment shows a choice. A dashed line divides its operands, and the guard of each operand says when it runs. `[else]` runs when no other guard holds.
- A `ref` box stands for an interaction that another diagram or view details. Its text names that diagram. The box covers the lifelines that take part.
- A call labelled `«create»` makes a new object, for example `GameEngine` in the `StartGame` diagram.
- In the `SaveProgress` and `Login` diagrams, the thick teal call is the HTTP call that leaves the app. The dashed teal line is the app boundary. The grey header is the backend.

## Proposals in these views

- `ApplyMoveRequest` holds the move only. `ResultPresenter.onFinish()` and `ApiClient.syncProgress()` are planned members. Today `ApiClient` has `getHealth()` only.
- The composition root binds `ProgressRepository` to `ApiProgressRepository` for a signed-in player. This is an assumption for team review: the docs do not say yet when `LocalProgressRepository` runs instead.
- The route path of `ProgressController.sync()` waits on the OpenAPI export of the endpoint.
- Flow 3: `GamePresenter.startGame`, `GamePresenter.onStart(request: StartGameRequest)` and `StartGameRequest.levelId` are planned members. No view says yet how the level definition reaches the level builder, so the sequence diagram draws that step as a `ref` box.
- Flow 4: `GamePresenter.undoMove` and `GamePresenter.onUndo()` are planned members. `MoveHistory.undo()` returns `void`, and `GameEngine` takes the state back through its private `restore(memento)`: the engine gives each `MoveCommand` this method as a function (decision 34, #159). `MoveCommand.after` and `redo()` come with `RedoableHistory` (#178).
- Flow 5: `AccountPresenter.login`, `AccountPresenter.onLogin(credentials: Credentials)`, the `client` and `mapper` attributes of `ApiAccountGateway`, `ApiDtoMapper.toCredentialsDto()`, `ApiDtoMapper.toSession()` and `ApiClient.signIn()` are planned members. No view gives `Credentials` a member. The endpoint name follows view 3.3 of the API class diagram: `AuthController.signIn(body: CredentialsDto): Promise<TokenDto>`. The answer to a rejected sign-in, a rejected `Promise` that `Login` turns into `Result.failure(error)`, is an assumption for team review.

## Render the images

The class views come from [`classes/views/flow-1-apply-move.html`](classes/views/flow-1-apply-move.html), [`classes/views/flow-2-save-progress.html`](classes/views/flow-2-save-progress.html), [`classes/views/flow-3-start-game.html`](classes/views/flow-3-start-game.html), [`classes/views/flow-4-undo-move.html`](classes/views/flow-4-undo-move.html) and [`classes/views/flow-5-login.html`](classes/views/flow-5-login.html). The sequence diagrams come from [`flows/views/seq-1-apply-move.html`](flows/views/seq-1-apply-move.html), [`flows/views/seq-2-save-progress.html`](flows/views/seq-2-save-progress.html), [`flows/views/seq-3-start-game.html`](flows/views/seq-3-start-game.html), [`flows/views/seq-4-undo-move.html`](flows/views/seq-4-undo-move.html) and [`flows/views/seq-5-login.html`](flows/views/seq-5-login.html). Each file holds one inline SVG, as the class views do. The `.png` image next to it is that SVG alone, in a page 1236 px wide, rendered at scale 2 by a headless browser. Commit each `.html` file together with its `.png` image.
