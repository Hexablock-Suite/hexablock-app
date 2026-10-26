# Requirements

This file is the team's working copy of the project requirements, written in our own words. It is the canonical requirements document for both repositories; `hexablock-api/docs/REQUIREMENTS.md` holds the backend view and links here.

- **Source:** the course statement "Proyecto Semestral — HexaBlock Suite", version 1.0, issued 2026-10-23. It is not redistributed in this repository. Each item cites its section as `§n`.
- **Status words:** **Required** comes from the statement. **A#** is an assumption we work under until the professor answers. **D#** is a team design decision. **Q#** is an open question for the professor. **C#** is a confirmation we will ask for, but it does not block work.
- **Rule:** when a requirement, an assumption or an answer from the professor changes, update this file in the same pull request.

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

## 2. Generic engine (§3.1)

Required:

- A hexagonal board generic over the cell type, in axial coordinates (q, r), with configurable shape, neighbors, axis traversal and rotation. It is written once and used by all four variants.
- A rules contract generic over cell, move and state: valid moves, apply a move, run the resolution rule, evaluate the end of the game. Each variant implements it.
- A game engine generic over cell, move and state that runs the turn cycle (start, receive, validate, apply, resolve, evaluate, notify). It knows no variant and no UI framework.
- Abstractions for the piece source (seeded random generator or fixed list per level), the scoring policy and the progress model (high score or levels with stars), all interchangeable.
- Bounded generics where the engine needs a capability of the cell content (for example a mergeable bound for Hexa Merge). The README explains why each bound exists.
- `docs/EXTENSIBILITY.md` explains, step by step with real class names, which files a fifth variant adds and which files it does **not** touch. In the defense the jury proposes a small rule change (board size, scoring policy or piece shape) and the change must stay in new classes or configuration.

## 3. Principles, patterns and architecture

Required:

- **SOLID (§3.2):** every principle used is documented in the README with a concrete example from our code. The engine has no conditionals on the variant type (LSP). Undo, timing and seeded randomness are separate interfaces, so Hexa Lines does not implement undo (ISP).
- **GoF patterns (§3.3):** Strategy and Abstract Factory (one factory per variant) are mandatory. The statement also lists Builder, Singleton or single-scope injection, Prototype, Composite, Decorator, Adapter, Facade, Observer, Command, State, Template Method and Iterator. Each pattern used has a justification, a code excerpt and a README entry. See A10 and Q3.
- **Clean Architecture (§3.4):** four layers with dependencies pointing inward. The whole generic engine and the variant rules live in the entities layer with no external dependency. Use cases are generic, never one copy per game. A layer diagram is an image in the README and an editable source in the repo.
- **AOP (§3.5):** at least one cross-cutting aspect (logging, centralized errors with retry, profiling, authorization or caching), built as decorators or proxies over the use cases. One aspect on the generic use case covers all four variants. See A2.

## 4. Tests (§3.6)

Required:

- Unit tests for every entity, use case and service; each variant's rules have their own tests (lines on 3 axes, exact cover, cascade transfer, merge on collision).
- The engine is tested with a fake cell type, to show it depends on no variant.
- Mocks or stubs for repositories, network and a fixed-seed random source; Arrange-Act-Assert; names `should_[result]_when_[condition]`; tests check behavior, not implementation details.
- Integration tests: use cases with real repositories on an in-memory database; save and load progress per variant end to end.
- Widget and UI tests: rendering, interaction, and navigation between home, game selector, level selector, game, victory and defeat.
- Contract tests with Pact (recommended).
- CI runs the tests on every pull request.

## 5. App features (§5.1)

Required minimum:

1. Home screen with the suite name, settings and a game selector with the four variants.
2. Level selector for Fit and Sort, with progress and locked levels.
3. The shared engine: board, pieces, moves, resolution and end of game.
4. Lines and Merge playable without levels, with a saved high score.
5. Fit with at least 15 and Sort with at least 10 hand-made levels, loaded from configuration files, with rising difficulty.
6. Scoring per variant, defined and documented by the team.
7. Victory screen with score and next level or new game; defeat screen with retry.
8. Undo and redo in Fit; undo of one move in Merge.
9. Local persistence of progress per variant (completed levels, stars, scores).
10. Sound effects and background music, with mute.
11. At least Spanish and English.

## 6. Backend (§5.2)

Summary; the details live in `hexablock-api/docs/REQUIREMENTS.md`. Sign-up and sign-in with JWT; progress sync with `gameId` as a required key (one entry per user and variant); a global leaderboard per `gameId` and, for level-based variants, per level; read and update level definitions for Fit and Sort with one generic schema plus a section per `gameId`; Swagger/OpenAPI; consistent HTTP errors.

## 7. Documentation and deliverables

- **Diagrams (§4):** class diagram (generic types in UML template notation, layers, patterns), Clean layer diagram (ports and adapters), extensibility diagram (engine in the center, variants as extensions). Each one is a high-resolution image in the README and an editable source in `docs/`.
- **README (§6.1):** in English, with the sections the README skeleton already holds (a test keeps them).
- **Commits (§6.2):** Conventional Commits in English.
- **AI usage (§7):** `AI_USAGE.md` in each repo with the tools, a log per significant task (prompt, result, our changes, lessons) and a critical evaluation. Undocumented AI use counts as plagiarism, and the team must be able to explain any code in the defense.
- **Deliverables (§8):** the two repository URLs by the Module 7 inbox; diagrams and `docs/EXTENSIBILITY.md` in `docs/`; README and `AI_USAGE.md` on `main`; an Android or iOS executable with the four variants as a GitHub Release.
- **Integrity (§9):** no copied code without citation; individual commits are reviewed, and a member without significant commits can get a lower grade.

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
- **A9 — Backend scope (§6.1).** Until Q2 is answered, the backend also follows Clean Architecture, SOLID, the patterns where they fit naturally, and has its own diagrams.
- **A10 — Patterns (§3.3).** Until Q3 is answered, we implement every listed pattern where it fits without forcing it.

## 10. Team design decisions

- **D1 — Turn ownership (§3.1, §3.3, §3.4).** The game engine holds the turn skeleton (Template Method). Each variant supplies the steps through the rules contract (Strategy). The apply-move use case only loads, persists and carries the aspects.
- **D2 — States (§3.3).** Game lifecycle states (playing, resolving, paused, game over, victory) live in the domain. The menu belongs to the presentation layer.
- **D3 — Rendering (§1.5).** A shared board renderer draws the grid and delegates each cell to a cell renderer per variant (Strategy), which the variant's factory provides. The piece preview is a clone (Prototype). Visitor fits only inside the piece and figure Composite, where the node types are closed (cell and region) and the operations grow (area, bounds, rotation). A Visitor over variants would force every new variant to edit all visitors, which breaks the extensibility test.
- **D4 — Grid topology.** Neighbors, slide directions, line axes, rotation step, coordinates and screen layout live behind one topology interface. Rules ask the topology and never hard-code 6 directions, 3 axes or 60°. A minimal square topology used in engine tests proves the engine does not depend on hexagons.
- **D5 — Seams for named variations.** Every axis in §8 gets its seam when the part it touches is built, never on the last day. A late request from the professor must then mean new classes or a new adapter, not a rewrite. This is deliberate insurance: we accept some extra abstraction, as long as each one keeps a written reason (a row in §8 or a layer boundary).

### Still to define (team)

- Sort: tie-break when two stacks have the same count of a color; whether the moving tiles are the whole top run; whether "10 of one color" means 10 in a row at the top, and what happens to tiles of other colors below.
- Merge: merge order inside one slide, and whether a tile merges once per move; probability of a 2 versus a 4; whether undo restores the random state or regenerates the new tile.
- Lines: whether a combo counts lines on several axes; what a streak is.
- Scoring per variant (§5.1.6) and what orders the per-level leaderboard for Fit and Sort; whether undo and remove count as moves for Fit stars.

## 11. Questions for the professor

Ask design questions, not debugging questions. On 2026-10-26 the professor refused to help with a bug ("Eso lo tienes que resolver tú", recording 39:15). He wants to know which layer a class lives in and how it interacts with the others, so he can judge whether the architecture is well designed (recording 39:20, 39:27). Bring the options you weighed, for example "we can do it this way or that way; which dependency is right?".

Real questions (they change the plan):

- **Q1:** The statement sets delivery on Monday 2026-12-14, and the class plan sets the final project delivery on 2026-12-07 and 2026-12-11, with grades on 2026-12-14. Which date and time is the deadline?
- **Q2:** Must the backend also meet the generics, GoF patterns, `EXTENSIBILITY.md` and the three diagrams, or only the client?
- **Q3:** Do we implement all 14 listed patterns, or a minimum? Which one?
- **Q4:** Who may update level definitions in the backend? The statement asks only for sign-up and sign-in, with no roles.
- **Q5:** In class on 2026-10-26 (recording 09:49) we heard "select at least three" games. The statement asks for an executable with the four variants (§8). Must we deliver three games or four?
- **Q6:** The statement does not set the team size. In class on 2026-10-26 we heard two or three members (recording 33:27 and 81:19). What is the maximum team size?

Confirmations (we already work under an assumption):

- **C1:** The Fit illustration has 21 cells and 20 of pieces. Do you expect the system to check that a level can be won? (A5)
- **C2:** Is a value object that wraps an integer acceptable as the Merge cell? (A1)
- **C3:** Does Merge end when the target tile appears, or may the player continue? (A3)
- **C4:** Are Sort trays random with a seed per level, or fixed in the level? (A4)
- **C5:** Is an AOP library allowed, or must the aspect be our own decorator? (A2)
- **C6:** Are public repositories acceptable? (A7)
- **C7:** May Fit pieces be mirrored, or only rotated? (A5)
