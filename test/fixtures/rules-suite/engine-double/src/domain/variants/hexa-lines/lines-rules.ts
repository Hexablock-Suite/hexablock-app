import { BaseGameRules } from '../../engine/rules';

export class LinesRules extends BaseGameRules<number, number> {
  apply(state: number, move: number): number {
    return state + move;
  }
}
