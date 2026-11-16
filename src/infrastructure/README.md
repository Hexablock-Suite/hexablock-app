Frameworks and drivers (storage, HTTP client, system clock, seeded random source). It may import every inner layer. `app/` holds the Expo Router routes, the outer framework layer.

`composition-root.ts` is the composition root: the only module that imports from every layer (S3-06 in #151, Q9). It builds the drivers `SystemClock`, `SeededRandomSource`, `ConsoleLogger` and `SequentialMatchIds`, the adapters of `src/adapters/` and the game use cases of each game inside the logging aspect. `game-registry.ts` maps each `GameId` to its variant factory, and `registered-games.ts` lists the games. `app/_layout.tsx` only calls the root through `CompositionRootProvider`, and a route reads it with `useCompositionRoot()`.

`ui/` holds the parts that the screens share (#169): the design tokens of the team prototype in `theme.ts`, the scene of sky and grass, the hex stone, the wood sign and the lip button, and `useHomePresenter()`, which builds `HomePresenter` from the game registry of the root.
