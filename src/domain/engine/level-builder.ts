import type { TopologyId } from './geometry-factory';

// Builder (statement §3.3, classes.md decision 15, D9): it builds the level of one game
// step by step. Each step returns the builder, and only `build()` returns the level.
// `LevelDefinition` directs the builder: first the topology, then the section of the game.
// A level builder holds a `GeometryFactory` (classes.md decision 17). It refuses a topology
// of another family, and it turns each coordinate of the section into a coordinate value.
// The section is the typed part of a level file (DS-6). The engine knows no variant,
// so the section arrives as `unknown`, and the builder of the variant checks it at runtime,
// as `GeometryFactory.createCoord()` checks its values.
// The builder never reads a file (classes.md decision 24).
export interface ILevelBuilder<TLevel> {
  withTopology(topology: TopologyId): ILevelBuilder<TLevel>;
  withSection(section: unknown): ILevelBuilder<TLevel>;
  build(): TLevel;
}
