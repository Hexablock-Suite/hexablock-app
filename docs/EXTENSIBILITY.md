# Extensibility

This page explains how to add a fifth variant. The example is Hexa Fill, the game that statement §3.1 names («por ejemplo, Hexa Fill: pintar celdas con restricciones»). Its rules are not designed yet, so every `Fill` name below is a placeholder.

The steps follow the [class diagram](architecture/classes.md) and the [extensibility diagram](architecture/extensibility.md). The engine, the four variants and the first use cases exist in `src/`. The classes of layers 3 and 4 that the steps name are planned. Some engine classes are planned too, for example the progress models and `RedoableHistory`. When a planned class exists, this page names its real file.

## The rule

A new variant adds classes and data. It changes no engine file, no other variant, no use case and no presenter (APP-NFR-06). Three things make this possible:

- The engine depends only on its contracts: `IVariantFactory`, `IGameRules`, `IScoringPolicy`, `IPieceSource`, `IProgressModel` and `BoardState`. It never names a variant (rule `engine-no-variants`).
- [`GameFactory`](../src/domain/engine/game-factory.ts) puts a game together for every variant (decision 40). It asks three generators for the ids of the match, of the first state and of its board, and the variant factory for the parts. So a new variant writes no assembly code and creates no id.
- `GameId` is open. It is a value object over a validated string, not a closed list of four games, and each variant factory declares its own id (D15, decision 30). So the new id needs no change in the engine.

## Steps

1. Create the folder `src/domain/variants/hexa-fill/`. Rule `variants-isolated` lets it import only `src/domain/engine/` and its own files.
2. Write the three type arguments: the cell `FillCell` (`TCell`), the move `FillMove` (`TMove`) and the state `FillState<TCoord>` (`TState`), which implements [`BoardState<FillCell, TCoord>`](../src/domain/engine/board-state.ts). A class that names the coordinate type `TCoord` declares it, so the variant runs on any geometry. The state is an entity inside the `GameEngine` aggregate (decisions 7 and 26), so `FillState` follows the same rules as the four states of the code:
   - **Identity.** Its constructor takes its own [`GameStateId`](../src/domain/engine/game-state-id.ts), the [`MatchId`](../src/domain/engine/match-id.ts) of its game and its board. `equals()` compares the `GameStateId` only, and `belongsTo(match)` compares the `MatchId`. `clone()` keeps both ids.
   - **Private fields.** No other class reads or writes a field of the state.
   - **Business methods.** The state changes in place, only through its own methods with business names. Each one returns nothing, and a refused input throws a `RangeError` and leaves the state as it was. `addPoints(points: Score)` adds the points of a turn, and the state keeps its score as a [`Score`](../src/domain/engine/score.ts).
   - **The photo.** `snapshot()` returns a frozen `FillSnapshot`, which extends `BoardSnapshot<FillCell, TCoord>` with the data of the variant and narrows `view()`, the plain data for the screen (decision 29). `restore(snapshot)` takes a photo of the same state back in place, and calls `checkOwnSnapshot()` before it writes anything.
   - **The gate.** `test/gates/state-writes-gate.test.ts` reads the new state file too (rule R-state-writes in `AGENTS.md`).
3. Write the rules: `FillRules` extends `BaseGameRules<FillMove, FillState>` and implements the steps `isValid()`, `apply()`, `resolve()` and `evaluate()`, plus `validMoves()`, the lazy generator of the valid moves (decision 33). The rules read the photo of the state and ask the state queries with business names. They change the state only through its business methods, and `apply()` returns the state that it receives. The template method `playTurn()` stays in the engine (D13).
4. Write the scoring policy: `FillScoring` implements `IScoringPolicy<FillState>`. Its `score(before, after)` reads two photos of the state, `SnapshotOf<FillState>`, and returns the points of the turn as a `Score`, a safe integer of 0 or more. A bonus is a subclass of `ScoringDecorator`.
5. Write the factory: `FillFactory<TCoord>` implements `IVariantFactory<FillCell, TCoord, FillMove, FillState<TCoord>>`. It declares `gameId = GameId.of('hexa-fill')`. It keeps the [`GeometryFactory<TCoord>`](../src/domain/engine/geometry-factory.ts) that it receives in its `geometry` attribute, and it builds its board with a [`BoardBuilder`](../src/domain/engine/board-builder.ts) over that geometry (D11). The composition root chooses the family, for example [`HexGeometry`](../src/domain/engine/hex-geometry.ts), so the same factory runs on any figure. It creates the rules, the piece source, the scoring policy, the board, the progress model, the initial state and the history (decision 31). The factory creates no id. `createBoard(boardId)` passes the [`BoardId`](../src/domain/engine/board-id.ts) that it receives to `BoardBuilder.build(boardId)`. `createInitialState(matchId, stateId, boardId)` gives the first state its `GameStateId`, the `MatchId` of its game and the board of `createBoard(boardId)`. `GameFactory` asks the three generators for those ids and gives the same `MatchId` to the `GameEngine`. For the parts that it does not write, it picks engine classes: `SeededPieceSource` or `FixedListPieceSource`, `HighScoreProgress` or `LevelProgress`, `MoveHistory` or `RedoableHistory` (decision 3). A part that the game does not have, such as a piece source or undo, is none.
6. If Hexa Fill has levels, write `FillLevel` and `FillLevelBuilder`, which implements `ILevelBuilder<FillLevel>` and builds the level step by step (D9). Add the level files. An adapter reads each file, and the builder gets plain data (decision 24).
7. If Hexa Fill publishes its own events, write classes that extend `GameEvent`, for example `RegionFilled`.
8. In layer 3, write `FillStateMapper`, which implements `StateMapper<FillCell>` and turns each cell into a `CellView`.
9. In layer 4, write `FillCellRenderer`, which implements `CellRenderer<TCellView>`. Its folder is open (Q8).
10. Register the game: the composition root maps `hexa-fill` to `FillFactory`, `FillStateMapper` and `FillCellRenderer`, and the game selector shows the new entry. The composition root gives the `FillFactory` to a `GameFactory`, with the three id generators and the event publisher that every variant shares, and `StartGame` takes that `GameFactory`.
11. Test the rules of Hexa Fill in their own test suite. The engine tests and the tests of the other variants do not change.

## Files that a fifth variant adds

| Layer | Where                                              | What                                                                                                         |
| ----- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1     | `src/domain/variants/hexa-fill/`                   | `FillCell`, `FillMove`, `FillState` with its photo `FillSnapshot`, `FillRules`, `FillScoring`, `FillFactory` |
| 1     | `src/domain/variants/hexa-fill/`, only with levels | `FillLevel`, `FillLevelBuilder`                                                                              |
| 1     | `src/domain/variants/hexa-fill/`, only with events | One class per new event, for example `RegionFilled`                                                          |
| 3     | `src/adapters/`                                    | `FillStateMapper`                                                                                            |
| 4     | the folder of the cell renderers (Q8)              | `FillCellRenderer`                                                                                           |
| data  | the bundled level files, only with levels          | One file per hand-made level                                                                                 |
| tests | the test folder of the variant rules               | The rules suite of Hexa Fill                                                                                 |

## Files outside the new folders that change

| File                                   | Change                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| The composition root (file open, Q9)   | One entry that maps the new `GameId` to its factory, state mapper and cell renderer. |
| The game selector route in `app/`      | One more game in the list that the player picks from (APP-FR-01).                    |
| The text files for Spanish and English | The name of the new game in both languages (APP-FR-11).                              |

If Hexa Fill keeps levels on the backend, the backend adds a section for it in the level schema (DS-6). The backend repository documents that change.

## Files that do not change

| Layer | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Every file in `src/domain/engine/`: `GameEngine`, `GameFactory`, the three id generators `MatchIdGenerator`, `GameStateIdGenerator` and `BoardIdGenerator`, the ids `MatchId`, `GameStateId` and `BoardId`, `BaseGameRules`, `IGameRules`, `IVariantFactory`, `BoardState`, `BoardSnapshot`, `GameId`, `Board`, `BoardBuilder`, `GridTopology`, the geometry family, the piece sources, the progress models, the histories, `LevelTimer` and `GameEvent` |
| 1     | The four other variant folders: `hexa-lines/`, `hexa-fit/`, `hexa-sort/` and `hexa-merge/`                                                                                                                                                                                                                                                                                                                                                               |
| 2     | Every file in `src/application/`: the use cases, their ports, the aspects, `Result`, `MoveResult` and the other request and response models                                                                                                                                                                                                                                                                                                              |
| 3     | `GamePresenter`, `GameViewModel`, `GameEventBus`, the local repositories and `InMemoryRunningGameStore`                                                                                                                                                                                                                                                                                                                                                  |
| 4     | The HTTP client and repositories, the drivers, `BoardView`, `AudioManager`, and the game, level selector, victory and defeat routes                                                                                                                                                                                                                                                                                                                      |
| gates | `.dependency-cruiser.cjs` and the architecture tests                                                                                                                                                                                                                                                                                                                                                                                                     |

## Check

Before the defense, a branch adds Hexa Fill with these steps. Its diff must touch no file under `src/domain/engine/`, `src/application/` or the four other variant folders (APP-NFR-06). The same check applies to the three jury variations in view 2 of the [extensibility diagram](architecture/extensibility.md): a new board size, a new scoring policy and a new piece shape.
