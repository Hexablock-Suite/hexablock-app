# Class diagram

Status: draft for review with the professor, 2026-10-30. This first part covers layer 1: the generic engine and the four variants. The use cases, the adapters and the presenters come in the next parts.

This page answers statement §4.1 for the domain. It shows the generic types in UML template notation, how each variant instantiates them, and the design patterns that live in the domain. The source of each image is a PlantUML file in [`classes/`](classes/). IDs such as A1, D1 and Q8 refer to [`docs/REQUIREMENTS.md`](../REQUIREMENTS.md). The layers themselves are in [layers.md](layers.md).

## How to read it

- Color marks the Clean layer, with the colors of [layers.md](layers.md). Every class on this page is in layer 1, entities, so every class is yellow.
- A stereotype such as `«Strategy»` marks the role of the class in a GoF pattern. Color and stereotype never carry the same information.
- The dashed box at the top right of a class holds its type parameters. This is the UML template notation that §4.1 asks for.
- A `«bind»` arrow is a UML template binding. Its label names the type that each parameter takes in that variant.
- `«port»` marks an interface that an outer layer implements.
- Every class is planned. `src/domain/` holds only README files today.

## Part 1: the generic engine

`src/domain/engine/`. It imports no variant and no framework (rules `domain-no-framework` and `engine-no-variants`).

![Class diagram of the generic engine](classes/engine-core.svg)

## Patterns in the domain

Eleven of the fourteen patterns of §3.3 live in layer 1. D7 asks for a written reason for each one, so the last column names the requirement behind it.

| Pattern          | Classes                                                                          | Reason                                                                           |
| ---------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Strategy         | `IGameRules`, `IScoringPolicy`, `IPieceSource`, `IProgressModel`, `GridTopology` | Mandatory (§3.3). The variation dimensions of §1.5. D1 and D4.                   |
| Abstract Factory | `IVariantFactory` and one factory per variant                                    | Mandatory (§3.3).                                                                |
| Template Method  | `GameEngine.play()`                                                              | The turn skeleton (§3.1, §3.3, D1).                                              |
| State            | `GamePhase` and its five phases                                                  | The game lifecycle (§3.3, D2).                                                   |
| Command          | `MoveCommand`, `MoveHistory`, `RedoableHistory`                                  | Undo and redo (§3.3, §5.1.8).                                                    |
| Prototype        | `Cloneable`: `HexBoard`, `Piece`, `BoardState`                                   | Undo snapshots, rotation and the piece preview (§3.3, D3).                       |
| Composite        | `ShapeNode`, `CellNode`, `ShapeGroup`                                            | Pieces made of cells, Fit figures made of regions (§3.3, piece shape row of §8). |
| Iterator         | `HexBoard.line()`, `ring()` and `neighborhood()`                                 | Traversal by axis, ring and neighbors (§3.1, §3.3).                              |
| Decorator        | `ScoringDecorator`, `ComboMultiplierDecorator`                                   | The Lines combo and streak multiplier (§1.1), scoring row of §8.                 |
| Builder          | `ILevelBuilder`, `FitLevelBuilder`, `SortLevelBuilder`                           | Levels from configuration files (§3.3, §5.1.5), the Fit check of A5.             |
| Observer         | `GameEventPublisher` and the `GameEvent` classes; `GameEventBus` in layer 3      | Score, audio and screens react to game events (§3.3).                            |

The other three patterns live outside the domain, so the next parts draw them: Adapter (the repositories and the API client, layer 3), Facade (audio, layer 4) and Singleton (single-scope injection in the composition root).

## Decisions to check with the team

1. **Template Method by composition.** §3.3 describes Template Method as an abstract class with the variant steps in subclasses. D1 keeps the skeleton in `GameEngine.play()` and takes the steps from `IGameRules` (Strategy), so a variant never extends the engine. The cost: the professor may expect the inheritance form, with an abstract turn class and one subclass per variant.
2. **`GamePhase`, not `GameState`.** The State pattern classes are phases, because `TState` already names the state of a game. [layers.md](layers.md) uses the same name.
3. **Undo is optional per variant.** `GameEngine` holds zero or one `MoveHistory`, and the variant factory decides. Fit gets `RedoableHistory` with no limit, Merge gets `MoveHistory` with limit 1, and Lines and Sort get none. So Hexa Lines never implements `IUndoable` (§3.2).
4. **`IRedoable` is our addition.** The statement lists `IUndoable`, `ITimed` and `IRandomSeeded`. Merge undoes one move and never redoes, so redo gets its own interface (§3.2 ISP, §5.1.8).
5. **`Color` and `GameId` live in the engine.** Lines and Sort both use `Color`, and rule `variants-isolated` forbids one variant from importing another.
6. **One piece type for the four variants.** Every piece is a `Piece<TCell>`: a shape plus the content it puts on the board. A Sort piece is one cell with a stack, and a Merge spawn is one cell with a tile. So `IPieceSource<Piece<TCell>>` serves the four variants.
7. **The board changes in place.** `HexBoard.set()` changes the board, and `clone()` takes the snapshot for undo and for the piece preview. The alternative is an immutable board, where each move returns a new board. Then undo keeps the old board, and Prototype applies only to pieces.

## Render the images

The `.svg` images come from the `.puml` files. After you edit a `.puml` file, run this from the repository root:

```sh
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/docs/architecture/classes:/data" plantuml/plantuml:1.2026.9 -tsvg /data/engine-core.puml
```

Commit each `.puml` file together with its `.svg` image.
