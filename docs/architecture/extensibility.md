# Extensibility diagram

Status: draft for review with the team, 2026-10-31.

Statement §4 asks for an extensibility diagram with the engine in the center and the variants as extensions. This page answers it for the client. It also shows a second extension axis: the geometry family of decision 17 in the [class diagram](classes.md). IDs such as D4 and APP-NFR-06 refer to [`docs/REQUIREMENTS.md`](../REQUIREMENTS.md). [`docs/EXTENSIBILITY.md`](../EXTENSIBILITY.md) will give the file-by-file steps that APP-NFR-06 asks for.

## How to read it

- The yellow zone is layer 1, entities. Every class in the diagram lives there.
- The teal class is the generic engine. It knows no variant and no geometry (APP-NFR-03).
- A dashed frame groups one extension axis. Its label names the pattern and the source.
- A solid box is a planned class. A dashed box is a declared extension with no class yet. Its name is a placeholder.
- A realization arrow points from an extension to the engine contract it implements. So every dependency points to the center.
- The hollow diamond says that each variant factory keeps one `GeometryFactory` as an attribute.

## Engine, variants and geometries

![Extensibility: the generic GameEngine in the center; above it, the variant axis with LinesFactory, FitFactory, SortFactory, MergeFactory and a declared fifth variant; below it, the geometry axis with HexGeometry, SquareGeometry for the engine tests, and the declared TriangleGeometry and Geometry3D](extensibility/views/engine-variants-geometries.png)

## The two axes

- **Variants.** A new variant adds its factory, its rules, its cell type and its cell renderer. It changes no engine file (APP-NFR-06). The four variants of the statement are the first four extensions on this axis.
- **Geometries.** A new geometry adds one family: a coordinate type, a topology and the piece shapes (decision 17, D11). It changes no engine file and no variant. `HexGeometry` is the real family. `SquareGeometry` is the family of the engine tests (D4, APP-NFR-13). Triangular cells and a 3D board are declared variations in §8 of the requirements.
- **No class per pair.** Each variant factory receives a `GeometryFactory`. So a new geometry does not need one class for each game, and a new game does not need one class for each geometry.

## Render the image

The diagram comes from the HTML file in [`extensibility/views/`](extensibility/views/). It follows the same rules as the class diagram: open the file in a browser to see the drawing, and export the `.png` image again after each edit with `/diagram-design:export-diagram docs/architecture/extensibility/views/engine-variants-geometries.html --png-only`. Commit the `.html` file together with its `.png` image.
