import type { BoardState } from './board-state';
import type { Cloneable } from './cloneable';
import { GameEngine } from './game-engine';
import type { GameEventPublisher } from './game-events';
import type { MatchIdGenerator } from './match-id-generator';
import type { IVariantFactory } from './variant-factory';

// The factory of the aggregate (classes.md decision 40). It assembles one whole game:
// the id of the match, the family of parts that the variant factory creates, and the publisher.
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

  // A new game that has started. Each call asks the generator for a new id,
  // and the variant factory for new rules, a new history and a new first state.
  // So two games share no id, no board and no move.
  createGame(): GameEngine<TCell, TCoord, TMove, TState> {
    const game = new GameEngine<TCell, TCoord, TMove, TState>(
      this.ids.next(),
      this.variant.gameId,
      this.variant.createRules(),
      this.variant.createScoring(),
      this.events,
      this.variant.createHistory(),
    );
    game.start(this.variant.createInitialState());
    return game;
  }
}
