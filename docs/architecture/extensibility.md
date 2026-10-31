# Extensibility diagram

Status: draft for review with the team, 2026-10-31.

Statement §4.3 asks for a «Diagrama que muestre el motor genérico en el centro y las cuatro variantes como extensiones, resaltando los puntos de extensión (interfaces que una quinta variante debería implementar)». This page answers it for the client in four views. View 1 is that diagram. Views 2 to 4 show the other extensions that the requirements declare: the jury variations, the geometry family and the extension points outside the engine. Class names come from the [class diagram](classes.md). IDs such as D4 and APP-NFR-06 refer to [`docs/REQUIREMENTS.md`](../REQUIREMENTS.md). [`docs/EXTENSIBILITY.md`](../EXTENSIBILITY.md) will give the file-by-file steps that APP-NFR-06 asks for.

## How to read it

- The colored zone is the Clean layer, with the colors of [layers.md](layers.md). The outer layer is at the top and the inner layer is at the bottom, so every dependency points down.
- The teal class is the generic engine. It knows no variant and no geometry (APP-NFR-03).
- A dashed frame groups one extension axis or one pattern. Its label names the source.
- A solid box is a planned class. A dashed box is a declared extension with no class yet. Its name is a placeholder.
- A package (a box with a tab) is one variant folder. It lists the classes of that variant, and one realization arrow says that the variant implements the extension points.
- A list box names several classes of one kind, for example the local adapters.
- A realization arrow points from an extension to the contract it implements. A solid line with a hollow triangle is inheritance.
- A hollow diamond marks an object that the class keeps as an attribute (aggregation, decision 23).
- The dashed box at the top right of a class holds its type parameters (UML template notation).

## View 1: the extension points

The engine sits in the center of layer 1. Around it are the interfaces that a fifth variant implements, and the type arguments that it binds. The four variants of the statement and Hexa Fill, the example of §3.1 («por ejemplo, Hexa Fill: pintar celdas con restricciones»), implement them. Each variant also adds a state mapper in layer 3 and a cell renderer in layer 4 (D3).

![Extension points: GameEngine in the center of layer 1; around it IVariantFactory, IGameRules with the abstract BaseGameRules, IScoringPolicy, IPieceSource, IProgressModel, ILevelBuilder, the TCell, TMove and TState type arguments and the optional capabilities IUndoable, IRedoable, ITimed and IRandomSeeded; StateMapper in layer 3 and CellRenderer in layer 4; the packages Hexa Lines, Hexa Fit, Hexa Sort, Hexa Merge and the declared Hexa Fill implement them](extensibility/views/ext-1-extension-points.png)

## View 2: the jury variations

In the defense the jury proposes «un nuevo tamaño de tablero, una política de puntuación distinta o una nueva forma de pieza» (§3.1). Each change is new data or a new class, and the engine does not change (APP-NFR-06).

![The three jury variations: a new board size is data passed to BoardBuilder.withRegion(size); a new scoring policy is a class that implements IScoringPolicy or extends ScoringDecorator; a new piece shape is a ShapeGroup of CellNode cells; GameEngine does not change](extensibility/views/ext-2-jury-variations.png)

| Variation      | What is new                                                                                | Where it lives                                                                                                                   | What does not change                          |
| -------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Board size     | A size value: configuration data (§8)                                                      | The level file (`SortLevel.radius`), or the size that `LinesFactory` or `MergeFactory` passes to `BoardBuilder.withRegion(size)` | `Board`, `GridTopology`, `GameEngine`         |
| Scoring policy | A class that implements `IScoringPolicy<TState>`, or a `ScoringDecorator` for a bonus (§8) | The variant folder, `src/domain/variants/<variant>/`. The variant factory returns it from `createScoring()`                      | `GameEngine`, which calls `score()` as before |
| Piece shape    | A piece definition as data: a `ShapeGroup` of `CellNode` cells (§8)                        | The Fit level file (`FitLevel.pieces`), or the piece list of the variant                                                         | `Piece`, `IPieceSource`, `GameEngine`         |

## View 3: the geometry axis

A new geometry adds one family: a coordinate type, a topology and the piece shapes (decision 17, D11). It changes no engine file and no variant. `HexGeometry` is the real family. `SquareGeometry` is the family of the engine tests (D4, APP-NFR-13). Triangular cells and a 3D board are declared variations in §8 of the requirements. Each variant factory receives a `GeometryFactory`, so a new geometry needs no class for each game, and a new game needs no class for each geometry.

![The geometry axis: the generic GameEngine in the center; above it, the variant factories LinesFactory, FitFactory, SortFactory, MergeFactory and the declared FillFactory; below it, HexGeometry, SquareGeometry for the engine tests, and the declared TriangleGeometry and Geometry3D](extensibility/views/ext-3-geometry-axis.png)

## View 4: outside the engine

Layers 2 to 4 have their own extension points. The view shows only the ones that §8 or the class diagram declare.

- **Database and backend.** A new storage or backend is one more adapter of the layer 2 ports. The use cases do not change (§3.3, §3.4, decision 22).
- **Level origin (A6).** `BundledLevelRepository` and `ApiLevelRepository` both implement `LevelRepository`, so bundled levels work offline (APP-FR-15).
- **Observer.** A new subscriber implements `GameEventListener` and subscribes to `GameEventBus`, which implements the engine port `GameEventPublisher`.
- **Aspects.** A new aspect extends `UseCaseAspect` and wraps any use case (§3.5, APP-NFR-11).
- **Desktop and a game with no board (D5).** Both are planned seams with no class yet. The layer of the game registry is still open.

![Outside the engine: HTTP adapters in layer 4 and local adapters in layer 3 implement the output ports of layer 2, with the two level origins of A6; GameEventBus implements GameEventPublisher and AudioManager listens to it; the aspects extend UseCaseAspect; the declared DesktopLayout, NewStorageAdapter, NewListener, GameRegistry, GameModule and CachingAspect are placeholders](extensibility/views/ext-4-outer-layers.png)

## Extension points by variant

Each row is one extension point. Each cell names the class or the type argument that the variant gives, or «—» when it gives nothing. Every name in the Fill column is a placeholder, because Hexa Fill has no class yet. The exceptions are `HighScoreProgress` and `LevelProgress`, which live in the engine. The team decides later whether Hexa Fill has levels, a piece source or undo.

| Extension point                      | Lines                                      | Fit                                                            | Sort                                                | Merge                                  | Fill                                   |
| ------------------------------------ | ------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| `IVariantFactory`                    | `LinesFactory`                             | `FitFactory`                                                   | `SortFactory`                                       | `MergeFactory`                         | `FillFactory`                          |
| `IGameRules` through `BaseGameRules` | `LinesRules`                               | `FitRules`, wrapped in `TimedRulesDecorator`                   | `SortRules`                                         | `MergeRules<TCell extends IMergeable>` | `FillRules`                            |
| `TCell`                              | `Color` (engine)                           | `PieceId`                                                      | `ColorStack`                                        | `MergeTile`                            | `FillCell`                             |
| `TMove`                              | `PlacePiece`                               | `FitMove`: `PlaceFitPiece`, `RemoveFitPiece`, `RotateFitPiece` | `PlaceStack`                                        | `Slide`                                | `FillMove`                             |
| `TState`                             | `LinesState`                               | `FitState`                                                     | `SortState`                                         | `MergeState<MergeTile>`                | `FillState`                            |
| `IScoringPolicy`                     | `LinesScoring`, `ComboMultiplierDecorator` | `FitScoring`                                                   | `SortScoring`                                       | `MergeScoring`                         | `FillScoring`                          |
| `IPieceSource`                       | `SeededPieceSource`                        | `FixedListPieceSource`                                         | `SeededPieceSource` or `FixedListPieceSource` (A4)  | `SeededPieceSource`                    | —                                      |
| `IProgressModel`                     | `HighScoreProgress`                        | `LevelProgress`, with stars                                    | `LevelProgress`                                     | `HighScoreProgress`                    | `HighScoreProgress` or `LevelProgress` |
| `ILevelBuilder`                      | —                                          | `FitLevelBuilder`, with `FitLevel`                             | `SortLevelBuilder`, with `SortLevel`                | —                                      | —                                      |
| `IUndoable`, `IRedoable`             | —                                          | `RedoableHistory`, no limit                                    | —                                                   | `MoveHistory`, limit 1                 | —                                      |
| `ITimed`                             | —                                          | `LevelTimer`, through `TimedRulesDecorator`                    | —                                                   | —                                      | —                                      |
| `IRandomSeeded`                      | `SeededPieceSource`                        | —                                                              | `SeededPieceSource`, when the level chooses it (A4) | `SeededPieceSource`                    | —                                      |
| `GameEvent`                          | `LineCleared`                              | —                                                              | `StackMerged`                                       | `TileMerged`, `TargetReached`          | —                                      |
| `StateMapper` (layer 3)              | `LinesStateMapper`                         | `FitStateMapper`                                               | `SortStateMapper`                                   | `MergeStateMapper`                     | `FillStateMapper`                      |
| `CellRenderer` (layer 4, Q8)         | `LinesCellRenderer`                        | `FitCellRenderer`                                              | `SortCellRenderer`                                  | `MergeCellRenderer`                    | `FillCellRenderer`                     |

The capability classes `MoveHistory`, `RedoableHistory`, `LevelTimer` and `SeededPieceSource` live in the engine. A variant does not write them: its factory picks them (decision 3). `HighScoreProgress` and `LevelProgress` live in the engine too.

## Render the images

The views come from the HTML files in [`extensibility/views/`](extensibility/views/). They follow the same rules as the class diagram: open a file in a browser to see the drawing, and export the `.png` image again after each edit with `/diagram-design:export-diagram docs/architecture/extensibility/views/<view>.html --png-only`. Commit each `.html` file together with its `.png` image.
