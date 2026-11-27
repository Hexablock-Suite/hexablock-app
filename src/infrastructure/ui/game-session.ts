import { useState } from 'react';

import { GamePresenter } from '../../adapters/game-presenter';
import { DEFAULT_LANGUAGE, textCatalog, type Texts } from '../../adapters/texts/text-catalog';
import type { GameId } from '../../domain/shared/game-id';
import { TopologyId } from '../../domain/shared/topology-id';
import type { BoardLayout } from '../../adapters/board/board-layout';
import type { CellRenderer } from '../board/cell-renderer';
import type { CompositionRoot } from '../composition-root';
import { useCompositionRoot } from '../composition-root-provider';
import type { MoveControls } from './move-controls';

// What the game screen needs to show one game (issue #170): the presenter over the use cases
// of the game, the cell renderer, the move controls and the figure layout of its registry entry,
// and the texts of the screen (#175). The registry hides the type of a cell view,
// so the session keeps it hidden too.
export interface GameSession {
  readonly presenter: GamePresenter<unknown, unknown, unknown, unknown, unknown, unknown, unknown>;
  readonly renderer: CellRenderer<unknown>;
  readonly controls: MoveControls<unknown, unknown, unknown, unknown>;
  readonly layoutOf: (size: number) => BoardLayout<unknown>;
  readonly texts: Texts;
}

// The session of the game `gameId` in the composition root `root`, with the texts `texts`,
// on the board figure `figure`, by default the hexagon (#171).
// The presenter takes `StartGame`, `ApplyMove`, `UndoMove` and `RedoMove` (#178) of the root,
// each inside its logging aspect, and the state mapper and the move mapper (#405) of the registry entry. An id that the registry of the figure
// does not hold throws a RangeError.
export function gameSessionOf(
  root: CompositionRoot,
  gameId: GameId,
  texts: Texts,
  figure: TopologyId = TopologyId.hex,
): GameSession {
  const { screen } = root.registry(figure).gameOf(gameId);
  const { startGame, applyMove, undoMove, redoMove } = root.gameUseCases(gameId, figure);
  return {
    presenter: new GamePresenter(
      startGame,
      applyMove,
      undoMove,
      redoMove,
      screen.mapper,
      screen.moves,
      texts,
    ),
    renderer: screen.renderer,
    controls: screen.controls,
    layoutOf: (size) => screen.layoutOf(size),
    texts,
  };
}

// The session of the game `gameId` on the board figure `figure` for the life of the screen
// that asks for it. The screens show the default language until the player can choose one (#163).
export function useGameSession(gameId: GameId, figure: TopologyId): GameSession {
  const root = useCompositionRoot();
  const [session] = useState(() =>
    gameSessionOf(root, gameId, textCatalog[DEFAULT_LANGUAGE], figure),
  );
  return session;
}
