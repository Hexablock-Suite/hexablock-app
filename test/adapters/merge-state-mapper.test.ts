/** @jest-environment node */
import { GamePresenter } from '../../src/adapters/game-presenter';
import { MergeStateMapper } from '../../src/adapters/merge-state-mapper';
import { textCatalog } from '../../src/adapters/texts/text-catalog';
import { MergeView } from '../../src/domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../../src/domain/variants/hexa-merge/merge-tile';
import { gameUseCases } from '../support/application/game-use-cases';
import { mergeFactory } from '../support/variants/hexa-merge/merge-game';

// Issue #177: `MergeStateMapper` turns the plain response of Hexa Merge into the data of its
// screen. It maps each tile to its number, each free space to no number, and the payload
// to the target flag. The tile and the view deliver their data, so the mapper repeats no rule.
describe('MergeStateMapper', () => {
  it('should_give_the_number_of_the_tile_when_a_tile_occupies_the_space', () => {
    const mapper = new MergeStateMapper();

    expect(mapper.toView(MergeTile.of(2))).toEqual({ value: 2 });
    expect(mapper.toView(MergeTile.of(2).mergeWith(MergeTile.of(2)))).toEqual({ value: 4 });
    expect(mapper.toView(MergeTile.of(2048))).toEqual({ value: 2048 });
  });

  it('should_give_no_number_when_the_space_is_free', () => {
    expect(new MergeStateMapper().freeView()).toEqual({});
  });

  it('should_give_the_target_flag_of_the_payload_when_the_target_tile_exists_or_not', () => {
    const mapper = new MergeStateMapper();

    expect(mapper.toPayload(new MergeView(true))).toEqual({ targetReached: true });
    expect(mapper.toPayload(new MergeView(false))).toEqual({ targetReached: false });
  });

  // The presenter builds the view model of a new game with the mapper: the two first tiles
  // of the hexagon of radius 1 show their numbers, the other 5 spaces show none, and the
  // target tile does not exist yet.
  it('should_show_the_first_tiles_and_no_target_when_the_presenter_starts_a_merge_game', async () => {
    const { startGame, applyMove } = gameUseCases(mergeFactory());
    const presenter = new GamePresenter(
      startGame,
      applyMove,
      new MergeStateMapper(),
      textCatalog.es,
    );

    await presenter.onStart();

    const views = presenter.viewModel().cells.map(([, view]) => view);
    const numbers = views.flatMap((view) => (view.value === undefined ? [] : [view.value]));
    expect(views).toHaveLength(7);
    expect(numbers).toHaveLength(2);
    expect(numbers.every((value) => value === 2 || value === 4)).toBe(true);
    expect(presenter.viewModel().payload).toEqual({ targetReached: false });
  });
});
