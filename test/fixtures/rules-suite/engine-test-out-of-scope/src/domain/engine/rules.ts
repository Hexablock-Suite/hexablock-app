export interface IGameRules<TMove, TState> {
  apply(state: TState, move: TMove): TState;
}

export abstract class BaseGameRules<TMove, TState> implements IGameRules<TMove, TState> {
  abstract apply(state: TState, move: TMove): TState;
}
