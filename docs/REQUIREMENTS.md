# Requirements

This file is the team's working copy of the project requirements, written in our own words. It is the canonical requirements document for both repositories; `hexablock-api/docs/REQUIREMENTS.md` holds the backend view and links here.

- **Source:** the course statement "Proyecto Semestral — HexaBlock Suite", version 1.0, issued 2026-10-23. It is not redistributed in this repository. Each item cites its section as `§n`.
- **Status words:** **Required** comes from the statement. **Derived** is not in the statement, but a statement item needs it. **A#** is an assumption we work under until the professor answers. **D#** is a team design decision. **Q#** is an open question for the professor. **C#** is a confirmation we will ask for, but it does not block work.
- **Requirement IDs:** **APP-FR-n** is a functional requirement: what the app does for the player. **APP-NFR-n** is a non-functional requirement: how the app is built, tested and documented. The backend uses API-FR-n and API-NFR-n. An ID never changes; a dropped requirement keeps its ID and says "Dropped".
- **Checks:** each requirement ends with _Check_, the evidence that shows it is met. Where a gate already exists, the check names it. The other checks are a proposal of 2026-10-30 for the team to review.
- **Rule:** when a requirement, an assumption or an answer from the professor changes, update this file in the same pull request.

| Kind                                             | IDs                      | Sections       |
| ------------------------------------------------ | ------------------------ | -------------- |
| Functional: what the app does for the player     | APP-FR-01 to APP-FR-15   | §5, §6         |
| Non-functional: how the app is built and checked | APP-NFR-01 to APP-NFR-24 | §2, §3, §4, §7 |

## 1. Product

One mobile app with four puzzle games on hexagonal boards, built on one generic engine, plus a REST backend (§2). The grade measures the engine, not the four games: four modules that repeat the board, rendering, persistence or game flow are graded as insufficient even if they work (§2).

|                     | Hexa Lines                                                   | Hexa Fit                                    | Hexa Sort                                                                                                                                            | Hexa Merge                                               |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Cell content (§1.5) | Color                                                        | Piece id                                    | Stack of colored tiles                                                                                                                               | Integer (power of 2)                                     |
| Board               | Hexagon, radius 4 (61 cells)                                 | Arbitrary figure per level                  | Hexagon, radius 2 (19 cells)                                                                                                                         | Hexagon, radius 2 (19 cells)                             |
| Move                | Place a piece from a tray of 3 (1 to 5 cells)                | Place, remove or rotate a piece (60° steps) | Place the offered stack on an empty cell                                                                                                             | Slide all tiles in one of 6 directions                   |
| Resolution          | Clear full lines on the 3 axes; several at once give a combo | None; check that the figure is covered      | Same-color top tiles of neighbor stacks move to the stack with most of that color, in cascade; 10 of one color clears the stack and counts as a goal | Two equal tiles that collide merge into double value     |
| Piece source        | Random                                                       | Fixed per level                             | Random (see A4)                                                                                                                                      | Random 2 or 4, injectable seed                           |
| End                 | No tray piece fits                                           | Figure covered (no defeat)                  | Goals reached / board full                                                                                                                           | Target tile appears / no move changes the board (see A3) |
| Progress            | High score                                                   | Levels with stars (moves and time)          | Levels                                                                                                                                               | High score                                               |
| Undo                | No                                                           | Unlimited, with redo                        | No                                                                                                                                                   | One move                                                 |

Sections: Lines §1.1, Fit §1.2, Sort §1.3, Merge §1.4, comparison §1.5.

## 2. Generic engine (non-functional, §3.1)

- **APP-NFR-01 — Generic board (§3.1).** A hexagonal board generic over the cell type, in axial coordinates (q, r), with configurable shape, neighbors, axis traversal and rotation. It is written once and used by all four variants. _Check:_ the four variants use the same board class with a different cell type, and no variant has a board class of its own.
- **APP-NFR-02 — Generic rules contract (§3.1).** A rules contract generic over cell, move and state: valid moves, apply a move, run the resolution rule, evaluate the end of the game. Each variant implements it. _Check:_ each variant's rules class implements the contract, and the engine calls only the contract.
- **APP-NFR-03 — Generic game engine (§3.1).** A game engine generic over cell, move and state that runs the turn cycle (start, receive, validate, apply, resolve, evaluate, notify). It knows no variant and no UI framework. _Check:_ `pnpm arch` passes rules `engine-no-variants` and `domain-no-framework`, and the engine test of APP-NFR-13 runs with a fake cell type.
- **APP-NFR-04 — Interchangeable sources and policies (§3.1).** Abstractions for the piece source (seeded random generator or fixed list per level), the scoring policy and the progress model (high score or levels with stars), all interchangeable. _Check:_ a test swaps each implementation and the engine code does not change.
- **APP-NFR-05 — Bounded generics (§3.1).** Bounded generics where the engine needs a capability of the cell content (for example a mergeable bound for Hexa Merge). The README explains why each bound exists. _Check:_ the README section "Generic Engine" lists every bound with its reason.
- **APP-NFR-06 — Extensibility proof (§3.1).** `docs/EXTENSIBILITY.md` explains, step by step with real class names, which files a fifth variant adds and which files it does **not** touch. In the defense the jury proposes a small rule change (board size, scoring policy or piece shape) and the change must stay in new classes or configuration. _Check:_ before the defense we apply each of the three example changes on a branch, and the diff touches no engine file.
- **APP-NFR-07 — Reproducible randomness (§1.4, §3.6).** Random generation is injectable and reproducible with a seed, so a game can be tested deterministically. _Check:_ gate `test/gates/domain-purity-gate.test.ts` (rule R-domain-determinism in `AGENTS.md`), and a Merge test with a fixed seed always gets the same new tiles.

## 3. Principles, patterns and architecture (non-functional)

- **APP-NFR-08 — SOLID (§3.2).** Every principle used is documented in the README with a concrete example from our code. The engine has no conditionals on the variant type (LSP). Undo, timing and seeded randomness are separate interfaces, so Hexa Lines does not implement undo (ISP). _Check:_ the README section "SOLID Principles" has one example per principle with a link to its file, and the engine has no `if` or `switch` on the game id.
- **APP-NFR-09 — GoF patterns (§3.3).** Strategy and Abstract Factory (one factory per variant) are mandatory. The statement also lists Builder, Singleton or single-scope injection, Prototype, Composite, Decorator, Adapter, Facade, Observer, Command, State, Template Method and Iterator. Each pattern used has a justification, a code excerpt and a README entry. See D7. _Check:_ the README section "Design Patterns" lists each pattern used with its justification and a link to its file, and Strategy and Abstract Factory are in it.
- **APP-NFR-10 — Clean Architecture (§3.4).** Four layers with dependencies pointing inward. The whole generic engine and the variant rules live in the entities layer with no external dependency. Use cases are generic, never one copy per game. A layer diagram is an image in the README and an editable source in the repo. _Check:_ `pnpm arch` passes, and [`architecture/layers.md`](architecture/layers.md) holds the layer diagram.
- **APP-NFR-11 — AOP (§3.5).** At least one cross-cutting aspect (logging, centralized errors with retry, profiling, authorization or caching), built as decorators or proxies over the use cases. One aspect on the generic use case covers all four variants. See A2. _Check:_ a test shows that one aspect runs for the four variants, and the use case it wraps has no line of the aspect's code.

## 4. Tests (non-functional, §3.6)

- **APP-NFR-12 — Unit tests.** Unit tests for every entity, use case and service; each variant's rules have their own tests (lines on 3 axes, exact cover, cascade transfer, merge on collision). _Check:_ `pnpm test` runs them in CI, with one test file for the rules of each variant.
- **APP-NFR-13 — Engine without a variant.** The engine is tested with a fake cell type, to show it depends on no variant. _Check:_ an engine test uses a cell type and a square topology that exist only in the tests (D4).
- **APP-NFR-14 — Test doubles and style.** Mocks or stubs for repositories, network and a fixed-seed random source; Arrange-Act-Assert; names `should_[result]_when_[condition]`; tests check behavior, not implementation details. _Check:_ gate `test/gates/test-title-gate.test.ts` (rule R-test-names).
- **APP-NFR-15 — Integration tests.** Use cases with real repositories on an in-memory database; save and load progress per variant end to end. _Check:_ one integration test per variant saves progress and loads it back.
- **APP-NFR-16 — Widget and UI tests.** Rendering, interaction, and navigation between home, game selector, level selector, game, victory and defeat. _Check:_ a navigation test visits the six screens.
- **APP-NFR-17 — Contract tests.** Contract tests with Pact (recommended). _Check:_ `pnpm pact:check` passes, and `pacts/` is committed.
- **APP-NFR-18 — CI.** CI runs the tests on every pull request. _Check:_ the `verify` job of `.github/workflows/` runs on every pull request.

## 5. App features (functional, §5.1)

APP-FR-01 to APP-FR-11 keep the numbers of statement §5.1.

- **APP-FR-01 — Home screen (§5.1.1).** Home screen with the suite name, settings and a game selector with the four variants. _Check:_ a UI test opens each of the four variants from the selector.
- **APP-FR-02 — Level selector (§5.1.2).** Level selector for Fit and Sort, with progress and locked levels. _Check:_ for Fit and Sort, the selector shows which levels are completed, which are open and which are locked.
- **APP-FR-03 — Shared engine (§5.1.3).** The shared engine: board, pieces, moves, resolution and end of game. _Check:_ APP-NFR-01 to APP-NFR-03.
- **APP-FR-04 — Endless games (§5.1.4).** Lines and Merge playable without levels, with a saved high score. _Check:_ the high score of Lines and of Merge is still there after the app restarts.
- **APP-FR-05 — Hand-made levels (§5.1.5).** Fit with at least 15 and Sort with at least 10 hand-made levels, loaded from configuration files, with rising difficulty. _Check:_ a CI test counts the bundled level files and checks every Fit level against A5.
- **APP-FR-06 — Scoring (§5.1.6).** Scoring per variant, defined and documented by the team. _Check:_ the README documents the scoring of each variant. The rules are still open (§10, "Still to define").
- **APP-FR-07 — Victory and defeat (§5.1.7).** Victory screen with score and next level or new game; defeat screen with retry. _Check:_ a UI test reaches both screens and uses their buttons.
- **APP-FR-08 — Undo and redo (§5.1.8).** Undo and redo in Fit; undo of one move in Merge. _Check:_ in Fit, undo and then redo give back the same board; in Merge, a second undo in a row changes nothing; Lines and Sort show no undo.
- **APP-FR-09 — Local progress (§5.1.9).** Local persistence of progress per variant (completed levels, stars, scores). _Check:_ APP-NFR-15.
- **APP-FR-10 — Sound (§5.1.10).** Sound effects and background music, with mute. _Check:_ the mute option silences both the effects and the music.
- **APP-FR-11 — Languages (§5.1.11).** At least Spanish and English. _Check:_ every visible text has a Spanish and an English entry.

## 6. Backend features, client side (functional, §5.2)

The backend requirements live in `hexablock-api/docs/REQUIREMENTS.md`, as API-FR-01 to API-FR-06. In short: sign-up and sign-in with JWT; progress sync with `gameId` as a required key (one entry per user and variant); a global leaderboard per `gameId` and, for level-based variants, per level; read and update level definitions for Fit and Sort with one generic schema plus a section per `gameId`; Swagger/OpenAPI; consistent HTTP errors.

On 2026-10-30 the team closed two shapes of this contract. The detail is in `hexablock-api/docs/REQUIREMENTS.md` §4, under DS-5 and DS-6:

- **DS-5 — Progress shape.** One progress row per user and `gameId`, plus a level results table. The app sends a level result as `stars`, `moves` and `elapsedMs`, the field names of `GameResult`.
- **DS-6 — Level schema.** A common part (`gameId`, `levelId`, `order`, `version`, `topology`) plus a typed section per `gameId`. The Fit section holds `figure`, `pieces` and `witness`. The Sort section holds `radius`, `goals` and `source`.

DS-4, what orders the per-level leaderboard, is still open (§10, "Still to define").

The app needs its own side of these features. Statement §5.1 does not list them, so each one is **Derived** from the backend item it serves.

- **APP-FR-12 — Account (derived from §5.2.1).** The player can sign up and sign in from the app, and the app keeps the session for the next requests. _Check:_ after sign-in, a sync request carries the token.
- **APP-FR-13 — Progress sync (derived from §5.2.2).** The app sends the local progress of each variant to the backend. _Check:_ progress saved in the app appears in the backend entry for that user and `gameId`.
- **APP-FR-14 — Leaderboard (derived from §5.2.3).** The app shows the global leaderboard per variant and, for Fit and Sort, per level. Assumption: §5.1 lists no leaderboard screen, so its place in the app is ours to choose. _Check:_ a UI test shows both leaderboards from a stubbed API.
- **APP-FR-15 — Levels from the backend (derived from §5.2.4, A6).** Bundled levels always work offline; levels from the backend add to them or replace them. _Check:_ with the network off, every bundled level opens.

## 7. Documentation and deliverables (non-functional)

- **APP-NFR-19 — Diagrams (§4).** Class diagram (generic types in UML template notation, layers, patterns), Clean layer diagram (ports and adapters), extensibility diagram (engine in the center, variants as extensions, and the extension points that a fifth variant implements). Each one is a high-resolution image in the README and an editable source in `docs/`. In class on 2026-10-26 the professor asked for the class diagram to model the architecture (recording 00:00): it shows which layer each class lives in (27:16), and its relations between layers follow the dependency rule. He does not want an entity-relationship diagram (21:50). In the class and the consultation of 2026-10-30 he added two rules. A port that a class keeps as an attribute is an aggregation, and a type that a class only receives as a parameter is a dependency (consultation 06:49 to 07:05). A domain builder builds the logical structure and nothing more (42:00, 42:22 to 42:33), so an adapter reads each level file and the builder gets plain data. The class diagram follows both rules (decisions 23 and 24 in [`architecture/classes.md`](architecture/classes.md)). _Check:_ the README embeds the three images; [`architecture/layers.md`](architecture/layers.md), [`architecture/classes.md`](architecture/classes.md) and [`architecture/extensibility.md`](architecture/extensibility.md) hold the three sources.
- **Requirements method (class on 2026-10-26, recording 10:16):** the professor expects functional and non-functional requirements and a plan in one-week sprints. This file numbers them since 2026-10-30: APP-FR for functional and APP-NFR for non-functional. We grow them as the professor and the team confirm each item.
- **APP-NFR-20 — README (§6.1).** In English, with the sections the README skeleton already holds. _Check:_ gate `test/docs/docs-skeleton.test.ts` (rule R-docs-headings).
- **APP-NFR-21 — Commits (§6.2).** Conventional Commits in English. _Check:_ the commit-msg hook and gate `test/gates/commit-message-gate.test.ts` (rule R-conventional-commits).
- **APP-NFR-22 — AI usage (§7).** `AI_USAGE.md` in each repo with the tools, a log per significant task (prompt, result, our changes, lessons) and a critical evaluation. Undocumented AI use counts as plagiarism, and the team must be able to explain any code in the defense. _Check:_ no gate (rule R-ai-usage-log); each pull request adds its entry.
- **APP-NFR-23 — Deliverables (§8).** The two repository URLs by the Module 7 inbox; diagrams and `docs/EXTENSIBILITY.md` in `docs/`; README and `AI_USAGE.md` on `main`; an Android or iOS executable with the four variants as a GitHub Release. _Check:_ pushing a `v*` tag runs `.github/workflows/release-apk.yml`, which attaches the APK to a GitHub Release.
- **APP-NFR-24 — Integrity (§9).** No copied code without citation; individual commits are reviewed, and a member without significant commits can get a lower grade. _Check:_ no gate; the reviewer of each pull request checks the citations.

## 8. Variation register

Every abstraction needs a written reason, and there are two kinds. A declared change: the statement, the professor or the team names something that may vary; add a row here with its source. A layer boundary: an interface that keeps an inner layer from depending on an outer one needs no row, because the dependency rule is its reason. The statement is a starting point, not the limit, so the team adds its own rows too. An abstraction does not have to be a design pattern; a plain interface is often enough.

| Axis                                                                                                   | Source                                                                     | What absorbs it                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cell content, board shape, move type, resolution rule, piece source, end of game, progress model, undo | §1.5                                                                       | Cell, move and state type parameters; rules contract; piece source; progress model; separate undo interface                                                   |
| Board size                                                                                             | §3.1 (jury variation)                                                      | Board shape from configuration                                                                                                                                |
| Scoring policy                                                                                         | §3.1 (jury variation)                                                      | Scoring policy strategy, decorators for bonuses                                                                                                               |
| Piece shape                                                                                            | §3.1 (jury variation)                                                      | Piece definitions as data (composite of cells)                                                                                                                |
| Square cells instead of hexagons                                                                       | Professor, in class, before 2026-10-24; again 2026-10-26 (recording 69:52) | Grid topology behind one interface (D4)                                                                                                                       |
| Triangular cells                                                                                       | Professor, in class, 2026-10-26 (recording 73:38)                          | Grid topology behind one interface (D4)                                                                                                                       |
| 3D board                                                                                               | Professor, in class, 2026-10-26 (recording 32:17, 50:18)                   | Planned (D5): the topology with generic coordinates, so a 3D topology is one more implementation of D4                                                        |
| A different game with no board (Angry Birds as the example)                                            | Professor, in class, 2026-10-26 (recording 50:24)                          | Planned (D5): a game module contract and a game registry, so the app does not assume every game runs on the board engine                                      |
| Database engine (MongoDB instead of Postgres, backend)                                                 | Professor, in class, 2026-10-26 (recording 50:11)                          | Planned (D5): repository ports in the backend application layer and one adapter per database engine                                                           |
| Desktop as well as phone                                                                               | Professor, in class, 2026-10-26 (recording 13:26)                          | Expo already builds for the web (`react-native-web`, `web` in `app.json`). Planned (D5): the presentation layer does not assume touch input or a phone screen |
| End of game after the target tile                                                                      | §1.4 vs §5.1.4                                                             | End policy (A3)                                                                                                                                               |
| Sort piece source                                                                                      | §1.3, §1.5 vs §5.1.5                                                       | Piece source chosen per level (A4)                                                                                                                            |
| Level origin                                                                                           | §5.1.5 vs §5.2.4                                                           | Level repository with bundled files and backend (A6)                                                                                                          |

## 9. Assumptions

Each assumption holds under both readings of the statement, or names what changes if the answer differs.

- **A1 — Merge cell (§3.1).** The statement says the Merge cell is an integer and also that it carries a mergeable bound. A primitive integer cannot implement an interface, so the Merge cell is a value object that wraps an integer and implements the bound. It satisfies both sentences; the statement calls its names "orientativos". Confirmation C2.
- **A2 — Aspects (§3.5).** Aspects are our own decorators or proxies over the generic use case, not a library or framework interceptor. This holds whether libraries are allowed or not. Confirmation C5.
- **A3 — End of Merge (§1.4, §5.1.4).** Reaching the target tile is an event, not the end of the game; an end policy decides. Default: a victory screen with a "continue" option, as in 2048. Confirmation C3.
- **A4 — Sort pieces (§1.3, §1.5, §5.1.5).** Each Sort level chooses its piece source: seeded random or a fixed list. Default: seeded random per level, so a level is reproducible and can be designed. Confirmation C4.
- **A5 — Fit levels can be won (§1.2, §5.2.4).** The Fit illustration shows a figure of 21 cells and pieces of 20, against the rule that both areas are equal. We read it as a hint: every Fit level must be provably winnable. Equal area is necessary but not enough, and finding an exact cover is a search problem. So every level file carries the designer's solution (piece, rotation in 60° steps, position). Checking that witness is linear. The Fit Builder checks area and witness when a level loads, a CI test checks every bundled level, and the backend rejects a level whose witness fails. A search tool only helps level designers. Pieces rotate; they are never mirrored (§1.2 mentions rotation only). Confirmations C1 and C7.
- **A6 — Level origin (§5.1.5, §5.2.4).** Levels bundled in the app always work offline; levels from the backend add to them or replace them. Who may edit levels is Q4.
- **A7 — Public repositories (§2, §9).** Both repositories are public, because GitHub Free protects branches only on public repositories. Confirmation C6.
- **A8 — Delivery date.** We plan against the earliest date, 2026-12-07. See Q1.
- **A9 — Backend scope (§6.1).** Replaced by D6 on 2026-10-26.
- **A10 — Patterns (§3.3).** Replaced by D7 on 2026-10-26.

## 10. Team design decisions

- **D1 — Turn ownership (§3.1, §3.3, §3.4).** The game engine holds the turn skeleton (Template Method). Each variant supplies the steps through the rules contract (Strategy). The apply-move use case only loads, persists and carries the aspects. Amended by D13 on 2026-10-30: the turn skeleton lives in an abstract base class of the rules contract.
- **D2 — States (§3.3).** Game lifecycle states (playing, resolving, paused, game over, victory) live in the domain. The menu belongs to the presentation layer.
- **D3 — Rendering (§1.5).** A shared board renderer draws the grid and delegates each cell to a cell renderer per variant (Strategy), which the variant's factory provides. The piece preview is a clone (Prototype). Visitor fits only inside the piece and figure Composite, where the node types are closed (cell and region) and the operations grow (area, bounds, rotation). A Visitor over variants would force every new variant to edit all visitors, which breaks the extensibility test.
- **D4 — Grid topology.** Neighbors, slide directions, line axes, rotation step, coordinates and screen layout live behind one topology interface. Rules ask the topology and never hard-code 6 directions, 3 axes or 60°. A minimal square topology used in engine tests proves the engine does not depend on hexagons.
- **D5 — Seams for named variations.** Every axis in §8 gets its seam when the part it touches is built, never on the last day. A late request from the professor must then mean new classes or a new adapter, not a rewrite. This is deliberate insurance: we accept some extra abstraction, as long as each one keeps a written reason (a row in §8 or a layer boundary).
- **D6 — Backend scope (§6.1).** The backend meets the same standards as the client: generics, SOLID, Clean Architecture, the patterns it needs (D7), `EXTENSIBILITY.md` and its own diagrams. Decided by the team on 2026-10-26; it closes Q2 and replaces A9.
- **D7 — Patterns (§3.3).** Strategy and Abstract Factory are mandatory. We use the other listed patterns only where the design needs them, and each one has a written justification. We bring the patterns we identify to the professor as design questions (§11). Decided by the team on 2026-10-26; it closes Q3 and replaces A10.
- **D8 — Variants delivered (§8).** Three games are the minimum (class on 2026-10-26, recording 09:49). We deliver the four variants of the statement. Decided by the team on 2026-10-26; it closes Q5.
- **D9 — Board builder (§3.3).** The level builders of Fit and Sort stay, and a `BoardBuilder` in layer 1 builds the board too. It is the DDD factory of the board: it builds the logical structure and nothing more (class on 2026-10-30, recording 41:51, 42:00). «Entonces en DDD nuestro builder será la fábrica» (43:16). Its reasons: two construction paths (a region by radius for Lines, Sort and Merge; a figure for Fit, §1.2), the topology rows of §8 (D4) and the generic coordinate of D10. Decided by the team on 2026-10-30. See decision 15 in [`architecture/classes.md`](architecture/classes.md).
- **D10 — Generic engine names (§3.1, §8).** The engine names carry no geometry: `Board<TCell, TCoord>` and `GridTopology<TCoord>`. `HexCoord` and `HexTopology` are the hexagonal implementation. `Board` is the `HexBoard<TCell>` of §3.1, which calls its names «orientativos». The variant classes drop the `Hexa` prefix, and «Hexa Lines» and the others stay as display names. A triangular or 3D board is one more coordinate type and one more topology. In class on 2026-10-30 the professor asked for a board for hexagons, triangles and squares «con genéricos» (recording 58:21, 58:30). Decided by the team on 2026-10-30. See decision 16 in [`architecture/classes.md`](architecture/classes.md).
- **D11 — Geometry family (§3.3, §8).** An Abstract Factory of geometry in layer 1 creates the coordinate, the topology and the piece shapes of one geometry: hexagonal (the real one) and square (the engine tests, D4 and APP-NFR-13). The board builder, the level builders and each variant factory receive it by composition, so no class exists per game and geometry. Screen layout per geometry stays in the presentation layer. Decided by the team on 2026-10-30. See decision 17 in [`architecture/classes.md`](architecture/classes.md) and view 3 of [`architecture/extensibility.md`](architecture/extensibility.md).
- **D12 — Single scope (§3.3).** §3.3 names «Singleton (o inyección de dependencias con alcance único)». The composition root creates `AudioManager` and `SessionManager` once and injects them. No class has a static `instance()`. `AudioManager` stays the audio Facade. Decided by the team on 2026-10-30. See decision 18 in [`architecture/classes.md`](architecture/classes.md).
- **D13 — Template Method in an abstract base class (§3.3).** It amends D1. The abstract `BaseGameRules` implements the rules contract and holds the template method `playTurn()` over abstract steps. Each variant extends it. The game engine depends only on the rules contract, so Strategy stays. Decided by the team on 2026-10-30. See decision 21 in [`architecture/classes.md`](architecture/classes.md).
- **D14 — Pattern audit (§3.3).** The fourteen patterns of §3.3 all stay. `TimedRulesDecorator` wraps the rules contract and times the game, because Fit stars use time (§1.2). State keeps D2: no `MenuState`, because the menu is navigation in the presentation layer. Decided by the team on 2026-10-30. See decisions 19 and 20 in [`architecture/classes.md`](architecture/classes.md).

### Still to define (team)

- Sort: tie-break when two stacks have the same count of a color; whether the moving tiles are the whole top run; whether "10 of one color" means 10 in a row at the top, and what happens to tiles of other colors below.
- Merge: merge order inside one slide, and whether a tile merges once per move; probability of a 2 versus a 4; whether undo restores the random state or regenerates the new tile.
- Lines: whether a combo counts lines on several axes; what a streak is.
- Scoring per variant (§5.1.6) and what orders the per-level leaderboard for Fit and Sort (DS-4); whether undo and remove count as moves for Fit stars.

## 11. Questions for the professor

Ask design questions, not debugging questions. On 2026-10-26 the professor refused to help with a bug ("Eso lo tienes que resolver tú", recording 39:15). He wants to know which layer a class lives in and how it interacts with the others, so he can judge whether the architecture is well designed (recording 39:20, 39:27). Bring the options you weighed, for example "we can do it this way or that way; which dependency is right?".

Real questions (they change the plan):

- **Q1:** The statement sets delivery on Monday 2026-12-14, and the class plan sets the final project delivery on 2026-12-07 and 2026-12-11, with grades on 2026-12-14. Which date and time is the deadline?
- **Q2:** Closed by the team on 2026-10-26: the backend meets the same standards (D6).
- **Q3:** Closed by the team on 2026-10-26: the patterns the design needs, each justified (D7).
- **Q4:** Who may update level definitions in the backend? The statement asks only for sign-up and sign-in, with no roles.
- **Q5:** Closed by the team on 2026-10-26: three games are the minimum, and we deliver four (D8).
- **Q6:** Closed on 2026-10-26: the team is already set, with three members.

Layer questions from the draft layer diagrams of 2026-10-30. Each one lists the options in the draft page:

- **Q7 (app):** Closed by the team on 2026-10-30 with option B. No `BackendApi` port exists: the HTTP repositories and their DTO mapper live in `src/infrastructure/api/` and implement the layer-2 ports directly. The port named transport types in its methods, and in class on 2026-10-30 the professor called that «acoplamiento estructural» (recording 46:52, 47:36). See Q7 in [`docs/architecture/layers.md`](architecture/layers.md).
- **Q8 (app):** Where do the variant factory and the cell renderer live, given that `domain-no-framework` keeps React out of `src/domain/` and D3 asks the factory for the renderer? See Q8 in the same file.
- **Q9 (app):** Where does the composition root live: in `app/_layout.tsx`, or in a module in `src/infrastructure/` that `_layout.tsx` calls? See Q9 in the same file.
- **Q10 (backend):** Closed by the class of 2026-10-30: «Los puertos están en la capa de aplicación.» (recording 26:41). The ports live in `src/application`, as §3.4 says. See Q10 in the backend's `docs/architecture/layers.md`.
- **Q11 (backend):** Closed by the team on 2026-10-30: the Drizzle schema lives in `src/adapters/persistence/schema.ts`, next to the repositories that query it. Rule `adapters-never-import-infrastructure` kept them from importing it in `src/infrastructure/database/`.
- **Q12 (backend):** Where do the AOP aspects live: in `src/application` as a plain decorator over a logger port, or in `src/infrastructure` as a wrapper that the Nest modules apply? See Q12 in the backend's `docs/architecture/layers.md`.

Confirmations (we already work under an assumption):

- **C1:** The Fit illustration has 21 cells and 20 of pieces. Do you expect the system to check that a level can be won? (A5)
- **C2:** Is a value object that wraps an integer acceptable as the Merge cell? (A1)
- **C3:** Does Merge end when the target tile appears, or may the player continue? (A3)
- **C4:** Are Sort trays random with a seed per level, or fixed in the level? (A4)
- **C5:** Is an AOP library allowed, or must the aspect be our own decorator? (A2)
- **C6:** Are public repositories acceptable? (A7)
- **C7:** May Fit pieces be mirrored, or only rotated? (A5)
