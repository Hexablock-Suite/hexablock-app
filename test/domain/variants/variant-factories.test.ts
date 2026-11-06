/** @jest-environment node */
import type { BoardState } from '../../../src/domain/engine/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import { firstValidMove, startVariant } from '../../support/engine/variant-game';
import { fitFactory } from '../../support/variants/hexa-fit/fit-game';
import { linesFactory } from '../../support/variants/hexa-lines/lines-game';
import { mergeFactory } from '../../support/variants/hexa-merge/merge-game';
import { sortFactory } from '../../support/variants/hexa-sort/sort-game';

// The engine runs the four variants through one code path (issue 99, APP-FR-03).
// `playOnce()` reads only `IVariantFactory`: it has no branch on the game id.

function playOnce<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const { engine, rules } = startVariant(factory);
  const outcome = engine.play(firstValidMove(rules, engine.snapshot()));
  return { gameId: factory.gameId.value, outcome, phase: engine.phase.name };
}

describe('IVariantFactory', () => {
  it('should_play_each_variant_through_the_same_path_when_the_engine_gets_the_four_factories', () => {
    const results = [
      playOnce(linesFactory()),
      playOnce(fitFactory()),
      playOnce(sortFactory()),
      playOnce(mergeFactory()),
    ];

    expect(results.map((r) => [r.gameId, r.outcome])).toEqual([
      ['hexa-lines', 'playing'],
      ['hexa-fit', 'victory'],
      ['hexa-sort', 'playing'],
      ['hexa-merge', 'playing'],
    ]);
    expect(new Set(results.map((r) => r.gameId)).size).toBe(4);
  });
});
