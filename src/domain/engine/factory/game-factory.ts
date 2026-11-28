import { BoardId } from '../board/board-id';
import type { BoardState } from '../board/board-state';
import type { Cloneable } from '../cloneable';
import { GameEngine } from '../turn/game-engine';
import type { GameId } from '../../shared/game-id';
import { GameStateId } from '../board/game-state-id';
import type { LevelTimer } from '../turn/level-timer';
import type { MatchIdGenerator } from './match-id-generator';
import type { IGameRules } from '../turn/rules';
import { TimedRulesDecorator } from '../turn/timed-rules-decorator';
import type { IVariantFactory } from './variant-factory';
import type { LevelId } from '../../progress/level-id';

// The factory of the aggregate (classes.md decision 40). It assembles one whole game:
// the id of the match, the local ids of the first state and of its board, and the family
// of parts that the variant factory creates. `gameId` names the game: the composition root
// finds the variant factory of the chosen game with `isFor()` and gives both (issue #234).
// Only the root has global identity, so one generator gives the `MatchId`,
// and this class builds the local ids from it (decision 52).
// The game takes no publisher: it records its events, and `ApplyMove` delivers them (#233).
// `IVariantFactory` creates the parts of one variant. This class puts them together,
// and that work is the same for every variant, so no variant factory repeats it.
// It never names a variant and never branches on the game id (rule `engine-no-variants`).
// The item type of the piece source is `unknown`, because this class reads no piece.
// `levelId` names the level of the games of a level factory (decision 61, #180).
// `LevelGameFactories` gives it, and each new game keeps it. A game with no levels has none.
export class GameFactory<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> {
  constructor(
    private readonly gameId: GameId,
    private readonly variant: IVariantFactory<TCell, TCoord, TMove, TState, unknown>,
    private readonly ids: MatchIdGenerator,
    private readonly levelId?: LevelId,
  ) {}

  // A new game that has started. Each call asks the generator for one new `MatchId`,
  // and the variant factory for new rules, a new timer, a new history and a new first state.
  // The first state gets the `MatchId` of the game, and its own id and the id of its board
  // come from that `MatchId`, so the state belongs to the game. The timer gets the `MatchId` too,
  // so a timed variant gives its timer the id of the match (decision 50).
  // The root and the decorator of a timed game hold the same timer (decision 19).
  // So two games share no id, no board, no timer and no move.
  createGame(): GameEngine<TCell, TCoord, TMove, TState> {
    const matchId = this.ids.next();
    const timer = this.variant.createTimer(matchId);
    const game = new GameEngine<TCell, TCoord, TMove, TState>(
      matchId,
      this.gameId,
      timedRules(this.variant.createRules(), timer),
      this.variant.createScoring(),
      this.variant.createHistory(),
      timer,
      this.levelId,
    );
    game.start(
      this.variant.createInitialState(matchId, GameStateId.of(matchId), BoardId.of(matchId)),
    );
    return game;
  }
}

// The rules of a timed game run inside `TimedRulesDecorator`, which starts and stops the timer.
// A game with no timer keeps the plain rules of its variant.
function timedRules<TMove, TState>(
  rules: IGameRules<TMove, TState>,
  timer: LevelTimer | undefined,
): IGameRules<TMove, TState> {
  return timer === undefined ? rules : new TimedRulesDecorator(rules, timer);
}
