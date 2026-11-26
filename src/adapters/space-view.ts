// The cell view of one space: whether a cell occupies it (classes.md decision 14, issue #170).
// `SpaceCellRenderer` draws it. The cell renderer of each variant draws a free space with it.
export interface SpaceView {
  readonly occupied: boolean;
}
