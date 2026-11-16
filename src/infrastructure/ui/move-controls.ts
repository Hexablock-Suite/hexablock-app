import type { ReactNode } from 'react';

// What the move controls of a game get from the game screen (issue #177).
export interface MoveControlProps<TMove, TPayloadView> {
  // The payload view of the last view model. It does not exist before the first answer
  // of `StartGame`.
  readonly payload: TPayloadView | undefined;
  // Plays one move through `GamePresenter.onMove()`.
  onMove(move: TMove): void;
}

// Strategy (D3, classes.md decision 55, issue #177): the move controls of one variant.
// `GameStage` draws them below the board, and it names no variant. The game registry
// gives each game its controls in the texts of one language (`ScreenParts.controlsOf()`).
// The controls read only the payload view of the state mapper, so they repeat no rule.
// `MergeControls` implements it. A game without controls shows only its board.
export interface MoveControls<TMove, TPayloadView> {
  render(props: MoveControlProps<TMove, TPayloadView>): ReactNode;
}
