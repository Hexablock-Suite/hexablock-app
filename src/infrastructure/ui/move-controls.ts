import type { ReactNode } from 'react';

import type { GameViewModel } from '../../adapters/game-presenter';
import type { Texts } from '../../adapters/texts/text-catalog';
import type { BoardLayout } from '../board/board-layout';

// What the game screen gives to the move controls of one game (issue #175).
export interface MoveControlsProps<TCoord, TCellView, TPayloadView, TMove> {
  // The last view model of the presenter.
  readonly model: GameViewModel<TCoord, TCellView, TPayloadView>;
  // The texts of the language of the screen (APP-FR-11).
  readonly texts: Texts;
  // The layout of the board figure for a cell size, so the controls draw a piece as the board does.
  layoutOf(size: number): BoardLayout<TCoord>;
  // Plays one move through `GamePresenter.onMove()`.
  play(move: TMove): void;
  // Draws the board in its wood frame. The controls give it the handler of a press on a space.
  board(onPressSpace: (at: TCoord, cell: TCellView) => void): ReactNode;
}

// Strategy (D3, classes.md decision 14, issue #175): the move controls of one game.
// `GameStage` names no variant: it gives its view model, the board and `play()` to the controls
// of the game, and the controls lay out the board with their own parts. The controls build each
// move and play it through the presenter. The game registry of the composition root chooses
// the controls of each game, as it chooses its state mapper and its cell renderer.
// `render()` returns an element of a component, so the controls keep their own state.
export interface MoveControls<TCoord, TCellView, TPayloadView, TMove> {
  render(props: MoveControlsProps<TCoord, TCellView, TPayloadView, TMove>): ReactNode;
}

// The handler of a board with no move controls: a press plays nothing.
function ignoreSpace(): void {}

// The default move controls of the game registry (issue #175): the board alone.
// A press on a space plays nothing. Each «Play … on the game screen» task (#174, #176, #177)
// registers the controls of its variant in their place.
export class BoardOnlyControls implements MoveControls<unknown, unknown, unknown, unknown> {
  render({ board }: MoveControlsProps<unknown, unknown, unknown, unknown>): ReactNode {
    return board(ignoreSpace);
  }
}
