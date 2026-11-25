/** @jest-environment node */
import { Score } from '../../../../src/domain/engine/score';
import { ScoringDecorator } from '../../../../src/domain/engine/scoring-decorator';
import { hex, HexAxis, type HexCoord } from '../../../../src/domain/engine/hex-topology';
import { MergeScoring } from '../../../../src/domain/variants/hexa-merge/merge-scoring';
import { MergeState } from '../../../../src/domain/variants/hexa-merge/merge-state';
import { MergeTile } from '../../../../src/domain/variants/hexa-merge/merge-tile';
import { SlideSense, Slide } from '../../../../src/domain/variants/hexa-merge/slide';
import { TargetBonusDecorator } from '../../../../src/domain/variants/hexa-merge/target-bonus-decorator';
import {
  mergeBoard,
  mergeGame,
  noNewTiles,
  valueOf,
} from '../../../support/variants/hexa-merge/merge-game';
import { MATCH_ID } from '../../../support/engine/match-id';
import { STATE_ID } from '../../../support/engine/entity-ids';

// The target bonus of Hexa Merge: a jury variation of the scoring (APP-NFR-06, issue #53).
// The slide that first makes the target tile scores 1000 more points.
// The merged values keep their points (issue #59, D22). The tests play through `GameEngine.play()`.

const east = Slide.of(HexAxis.q, SlideSense.forward);

// Plays one east slide on row r = 0 with the given tiles from the west edge, with the target 2048.
// `reachedBefore` tells whether a merge of the game made the target before this slide.
function slideRow(tiles: readonly number[], reachedBefore = false) {
  const board = mergeBoard(3);
  tiles.forEach((value, i) => board.occupy(hex(i - 2, 0), MergeTile.of(value)));
  const { engine } = mergeGame(
    new MergeState(STATE_ID, MATCH_ID, board, noNewTiles(), reachedBefore),
    MergeTile.of(2048),
    new TargetBonusDecorator(new MergeScoring<HexCoord, HexAxis>()),
  );
  engine.play(east);
  return engine.snapshot();
}

describe('Hexa Merge target bonus', () => {
  it('should_add_the_target_bonus_to_the_merged_value_when_a_slide_first_makes_the_target_tile', () => {
    const state = slideRow([1024, 1024]);

    expect(state.mergedTiles().map(valueOf)).toEqual([2048]);
    expect(state.hasReachedTarget()).toBe(true);
    // 2048 for the merge + 1000 for the target.
    expect(state.scoreSoFar()).toEqual(Score.of(3048));
  });

  it('should_score_only_the_merged_value_when_the_game_made_the_target_before_the_slide', () => {
    const state = slideRow([1024, 1024], true);

    expect(state.mergedTiles().map(valueOf)).toEqual([2048]);
    expect(state.scoreSoFar()).toEqual(Score.of(2048));
  });

  it('should_score_only_the_merged_values_when_the_slide_does_not_make_the_target_tile', () => {
    expect(slideRow([2, 2, 4, 4]).scoreSoFar()).toEqual(Score.of(12));
    expect(slideRow([2, 4]).scoreSoFar()).toEqual(Score.of(0));
  });

  it('should_be_a_scoring_decorator_when_the_target_bonus_wraps_the_merge_scoring', () => {
    expect(new TargetBonusDecorator(new MergeScoring<HexCoord, HexAxis>())).toBeInstanceOf(
      ScoringDecorator,
    );
  });
});
