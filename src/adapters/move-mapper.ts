// Strategy (D3, classes.md decision 14, issue #405): turns the intent of the move controls
// of one game into the move of its domain. The controls of layer 4 send plain data, such as
// the text id of a piece or a rotation step as a number. The mapper of layer 3 turns that data
// into the value objects of the variant. So no control imports a class of a variant.
// `GamePresenter` holds one mapper and calls it before `ApplyMove`, and it never names
// a variant. The game registry of the composition root pairs the mapper of a game with
// its move controls, so both name the same `TIntent`.
export interface MoveMapper<TIntent, TMove> {
  // The domain move of `intent`.
  toMove(intent: TIntent): TMove;
}
