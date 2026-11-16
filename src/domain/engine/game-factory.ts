import { BoardId } from './board-id';
import type { BoardState } from './board-state';
import type { Cloneable } from './cloneable';
import { GameEngine } from './game-engine';
import type { GameEventPublisher } from './game-events';
import { GameStateId } from './game-state-id';
import type { MatchIdGenerator } from './match-id-generator';
import type { IVariantFactory } from './variant-factory';

// The factory of the aggregate (classes.md decision 40). It assembles one whole game:
// the id of the match, the local ids of the first state and of its board, the family of parts
// that the variant factory creates, and the publisher. Only the root has global identity,
// so one generator gives the `MatchId`, and this class builds the local ids from it (decision 52).
// `IVariantFactory` creates the parts of one variant. This class puts them together,
// and that work is the same for every variant, so no variant factory repeats it.
// It never names a variant and never branches on the game id (rule `engine-no-variants`).
// The item type of the piece source is `unknown`, because this class reads no piece.
export class GameFactory<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  constructor(
    private readonly variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
    private readonly ids: MatchIdGenerator,
    private readonly events: GameEventPublisher,
  ) {}

  // A new game that has started. Each call asks the generator for one new `MatchId`,
  // and the variant factory for new rules, a new history and a new first state.
  // The first state gets the `MatchId` of the game, and its own id and the id of its board
  // come from that `MatchId`, so the state belongs to the game. The rules get the `MatchId` too,
  // so a timed variant gives its timer the id of the match (decision 50).
  // So two games share no id, no board and no move.
  createGame(): GameEngine<TCell, TCoord, TMove, TState> {
    const matchId = this.ids.next();
    const game = new GameEngine<TCell, TCoord, TMove, TState>(
      matchId,
      this.variant.gameId,
      this.variant.createRules(matchId),
      this.variant.createScoring(),
      this.events,
      this.variant.createHistory(),
    );
    game.start(
      this.variant.createInitialState(matchId, GameStateId.of(matchId), BoardId.of(matchId)),
    );
    return game;
  }
}
