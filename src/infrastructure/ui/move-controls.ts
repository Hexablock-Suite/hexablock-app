import type { ReactNode } from 'react';

import type { GameViewModel } from '../../adapters/game-presenter';
import type { Texts } from '../../adapters/texts/text-catalog';
import type { BoardLayout } from '../../adapters/board/board-layout';

// What the game screen gives to the move controls of one game (issue #175).
export interface MoveControlsProps<TCoord, TCellView, TPayloadView, TIntent> {
  // The last view model of the presenter.
  readonly model: GameViewModel<TCoord, TCellView, TPayloadView>;
  // The texts of the language of the screen (APP-FR-11).
  readonly texts: Texts;
  // The layout of the board figure for a cell size, so the controls draw a piece as the board does.
  layoutOf(size: number): BoardLayout<TCoord>;
  // Plays the move of one intent through `GamePresenter.onMove()`. The intent is plain data,
  // and the move mapper of the game builds the domain move (#405).
  play(intent: TIntent): void;
  // Takes back the last move through `GamePresenter.onUndo()` (APP-FR-08, issue #178).
  // The view model says whether the game has undo and whether a move can go back.
  undo(): void;
  // Plays the last undone move again through `GamePresenter.onRedo()` (#178).
  redo(): void;
  // Draws the board in its wood frame. The controls give it the handler of a press on a space.
  board(onPressSpace: (at: TCoord, cell: TCellView) => void): ReactNode;
}

// Strategy (D3, classes.md decision 14, issue #175): the move controls of one game.
// `GameStage` names no variant: it gives its view model, the board, `play()`, `undo()` and
// `redo()` to the controls of the game, and the controls lay out the board with their own parts.
// The controls choose which of the undo and the redo of the view model they show (#178).
// The controls send a plain intent through the presenter, and the `MoveMapper` of the game in
// layer 3 builds the domain move (#405). So the controls import no class of a variant, and
// the conversion of the data is tested without React. The selection of a piece stays React
// state of the controls. The game registry of the composition root chooses the controls
// of each game, as it chooses its state mapper, its move mapper and its cell renderer.
// `render()` returns an element of a component, so the controls keep their own state.
export interface MoveControls<TCoord, TCellView, TPayloadView, TIntent> {
  render(props: MoveControlsProps<TCoord, TCellView, TPayloadView, TIntent>): ReactNode;
}
