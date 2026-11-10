import type { BoardIdGenerator } from './board-id-generator';
import type { BoardState } from './board-state';
import type { Cloneable } from './cloneable';
import { GameEngine } from './game-engine';
import type { GameEventPublisher } from './game-events';
import type { GameStateIdGenerator } from './game-state-id-generator';
import type { MatchIdGenerator } from './match-id-generator';
import type { IVariantFactory } from './variant-factory';

// The factory of the aggregate (classes.md decision 40). It assembles one whole game:
// the ids of the match, of the first state and of its board, the family of parts that
// the variant factory creates, and the publisher. One generator gives each kind of id.
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
    private readonly stateIds: GameStateIdGenerator,
    private readonly boardIds: BoardIdGenerator,
    private readonly events: GameEventPublisher,
  ) {}

  // A new game that has started. Each call asks each generator for one new id,
  // and the variant factory for new rules, a new history and a new first state.
  // The first state gets its own id, the id of its board and the `MatchId` of the game,
  // so the state belongs to the game. So two games share no id, no board and no move.
  createGame(): GameEngine<TCell, TCoord, TMove, TState> {
    const matchId = this.ids.next();
    const stateId = this.stateIds.next();
    const boardId = this.boardIds.next();
    const game = new GameEngine<TCell, TCoord, TMove, TState>(
      matchId,
      this.variant.gameId,
      this.variant.createRules(),
      this.variant.createScoring(),
      this.events,
      this.variant.createHistory(),
    );
    game.start(this.variant.createInitialState(matchId, stateId, boardId));
    return game;
  }
}
