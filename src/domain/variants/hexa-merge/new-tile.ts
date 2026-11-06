// One draw of the Merge tile source: the tile that appears after a slide, and where.
// `place` is a number in [0, 1). The rules turn it into one of the empty cells,
// so the cell and the value both come from the same seeded source (APP-NFR-07).
export interface NewTile<TCell> {
  readonly place: number;
  readonly tile: TCell;
}
