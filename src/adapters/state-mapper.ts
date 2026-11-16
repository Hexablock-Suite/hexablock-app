// Strategy (D3, classes.md decision 14, issue #170): turns the plain response of one game
// into the data of its screen. `GamePresenter` holds one mapper and never names a variant.
// The mapper repeats no rule: each value that it maps is a value that the state already computed.
// `TCell` and `TView` are the cell and the payload of `MoveResult`. `TCellView` is the data
// of one space for the cell renderer of the game, and `TPayloadView` is the data of the payload
// for the screen. The game registry of the composition root pairs the mapper of a game with
// its cell renderer, so both name the same `TCellView` (S3-07 in #151, «Propuesta,
// pendiente del equipo»).
export interface StateMapper<TCell, TView, TCellView, TPayloadView> {
  // The view of a space that `cell` occupies.
  toView(cell: TCell): TCellView;
  // The view of a free space. A free space has no cell, so the mapper needs no input.
  freeView(): TCellView;
  // The view of the variant payload of the response (#158).
  toPayload(payload: TView): TPayloadView;
}
