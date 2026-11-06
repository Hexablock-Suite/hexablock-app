/** @jest-environment node */
import { GameOver } from '../../../../src/domain/engine/game-events';
import { GameId } from '../../../../src/domain/engine/game-id';
import {
  DEFAULT_FOUR_CHANCE,
  mergeTileSource,
} from '../../../../src/domain/variants/hexa-merge/merge-tile-source';
import { Slide } from '../../../../src/domain/variants/hexa-merge/slide';
import { lintFixture } from '../../../support/run-tool';
import { hex, type HexAxis } from '../../../support/variants/hexa-merge/hex-topology';
import {
  mergeGame,
  mergeState,
  values,
  type HexMergeState,
} from '../../../support/variants/hexa-merge/merge-game';

// The new tiles of Hexa Merge (statement §1.4, APP-NFR-07, issue #95).
// The tests play through `GameEngine.play()` and the rules contract, on a hexagonal double.
// They code against the proposal on issue #57, «Propuesta, pendiente del equipo»:
// a new tile is 2 with 0.9 and 4 with 0.1, on an empty cell, from one seeded source,
// and a cloned state gives the same new tile again.

type Game = ReturnType<typeof mergeGame>;

// Plays the first valid slide of each turn, `turns` times, and keeps each board.
function playFirstSlides(game: Game, turns: number): Record<string, number>[] {
  const boards: Record<string, number>[] = [];
  for (let i = 0; i < turns; i += 1) {
    const [slide] = game.rules.validMoves(game.engine.snapshot());
    if (slide === undefined) break;
    game.engine.play(slide);
    boards.push(values(game.engine.snapshot()));
  }
  return boards;
}

// The cells that `after` has and `before` has not, with their values.
function added(
  before: Record<string, number>,
  after: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(Object.entries(after).filter(([key]) => !(key in before)));
}

function seeded(seed: number, fourChance?: number): HexMergeState {
  return mergeState([[hex(0, 0), 2]], 3, mergeTileSource(seed, fourChance));
}

describe('Merge new tiles', () => {
  it('should_get_the_same_new_tiles_when_two_games_use_the_same_seed', () => {
    const first = playFirstSlides(mergeGame(seeded(42)), 12);
    const second = playFirstSlides(mergeGame(seeded(42)), 12);
    const other = playFirstSlides(mergeGame(seeded(7)), 12);

    expect(first).toHaveLength(12);
    expect(second).toEqual(first);
    expect(Object.keys(first[0] ?? {})).toHaveLength(2);
    expect(other).not.toEqual(first);
  });

  it('should_put_one_new_tile_of_two_or_four_on_an_empty_cell_when_a_slide_is_accepted', () => {
    const game = mergeGame(seeded(1234));

    for (let i = 0; i < 20; i += 1) {
      const before = game.engine.snapshot();
      const [slide] = game.rules.validMoves(before);
      if (slide === undefined) break;
      const slid = values(game.rules.apply(before.clone(), slide));

      game.engine.play(slide);
      const after = values(game.engine.snapshot());

      const fresh = added(slid, after);
      expect(Object.keys(fresh)).toHaveLength(1);
      expect([2, 4]).toContain(Object.values(fresh)[0]);
      expect({ ...after, ...slid }).toEqual(after);
    }

    // A full board has no empty cell, so `resolve()` adds no tile and draws nothing.
    const full = mergeState(
      [
        [hex(0, 0), 2],
        [hex(1, 0), 4],
        [hex(1, -1), 8],
        [hex(0, -1), 4],
        [hex(-1, 0), 8],
        [hex(-1, 1), 4],
        [hex(0, 1), 8],
      ],
      2,
      mergeTileSource(5),
    );
    const next = mergeTileSource(5).next();
    const resolution = game.rules.resolve(full.clone());
    expect(values(resolution.state)).toEqual(values(full));
    expect(resolution.state.tiles.next()).toEqual(next);
  });

  it('should_draw_only_twos_or_only_fours_when_the_chance_of_a_four_is_zero_or_one', () => {
    const newValues = (fourChance: number): number[] => {
      const game = mergeGame(seeded(99, fourChance));
      let before = values(game.engine.snapshot());
      const out: number[] = [];
      for (let i = 0; i < 10; i += 1) {
        const [slide] = game.rules.validMoves(game.engine.snapshot());
        if (slide === undefined) break;
        const slid = values(game.rules.apply(game.engine.snapshot(), slide));
        game.engine.play(slide);
        const after = values(game.engine.snapshot());
        out.push(...Object.values(added(slid, after)));
        before = after;
      }
      expect(Object.keys(before).length).toBeGreaterThan(1);
      return out;
    };

    expect(newValues(0)).toEqual(Array(10).fill(2));
    expect(newValues(1)).toEqual(Array(10).fill(4));

    // The default chance is 0.1: about one tile in ten is a 4.
    const source = mergeTileSource(2026);
    let fours = 0;
    for (let i = 0; i < 1000; i += 1) if (source.next().tile.value === 4) fours += 1;
    expect(DEFAULT_FOUR_CHANCE).toBe(0.1);
    expect(fours).toBeGreaterThan(70);
    expect(fours).toBeLessThan(130);

    for (const bad of [-0.1, 1.1, Number.NaN]) {
      expect(() => mergeTileSource(1, bad)).toThrow(
        new RangeError(`The chance of a 4 must be a number from 0 to 1, not ${bad}.`),
      );
    }
  });

  it('should_give_the_same_new_tile_again_when_the_game_goes_back_to_a_cloned_state', () => {
    const game = mergeGame(seeded(31));
    playFirstSlides(game, 3);
    const saved = game.engine.snapshot();
    const slide = [...game.rules.validMoves(saved)][0] as Slide<HexAxis>;

    game.engine.play(slide);
    const played = values(game.engine.snapshot());
    // Undo restores the cloned state, so the same slide gives the same new tile.
    game.engine.start(saved);
    game.engine.play(slide);
    const replayed = values(game.engine.snapshot());

    const viaClone = values(game.rules.playTurn(saved.clone(), slide).state);
    const viaOriginal = values(game.rules.playTurn(saved, slide).state);
    const slid = values(game.rules.apply(saved.clone(), slide));

    expect(Object.keys(added(slid, played))).toHaveLength(1);
    expect(replayed).toEqual(played);
    expect(viaClone).toEqual(played);
    expect(viaOriginal).toEqual(played);
  });

  it('should_end_the_game_when_an_accepted_slide_and_its_new_tile_leave_no_slide_that_changes_the_board', () => {
    // A full hexagon of seven cells. The slide merges the two 4s of the row r = 1,
    // so one cell is empty. The new tile is a 4 on it, and no two neighbors are equal then.
    const { engine, rules, publisher } = mergeGame(
      mergeState(
        [
          [hex(0, 0), 2],
          [hex(1, 0), 4],
          [hex(1, -1), 8],
          [hex(0, -1), 4],
          [hex(-1, 0), 8],
          [hex(-1, 1), 4],
          [hex(0, 1), 4],
        ],
        2,
        mergeTileSource(3, 1),
      ),
    );

    const outcome = engine.play(Slide.of('q', 'forward'));

    expect(outcome).toBe('game-over');
    expect(values(engine.snapshot())).toEqual({
      '0,0': 2,
      '1,0': 4,
      '1,-1': 8,
      '0,-1': 4,
      '-1,0': 8,
      '-1,1': 4,
      '0,1': 8,
    });
    expect([...rules.validMoves(engine.snapshot())]).toEqual([]);
    expect(engine.phase.canPlay()).toBe(false);
    expect(publisher.events).toEqual([new GameOver(GameId.of('hexa-merge'), 'game-over', 0)]);
  });

  it('should_pass_the_domain_purity_gate_when_it_lints_the_merge_code', () => {
    const result = lintFixture('src/domain/variants/hexa-merge');

    expect(result.output).not.toContain('hexablock(no-ambient-nondeterminism)');
    expect(result.status).toBe(0);
  });
});
