/** @jest-environment node */
import { FixedListPieceSource } from '../../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../../src/domain/engine/region-size';
import { SortFactory } from '../../../../src/domain/variants/hexa-sort/sort-factory';
import { squareTopology } from '../../../support/engine/square-topology';
import { startVariant } from '../../../support/engine/variant-game';
import {
  chipsAt,
  place,
  sortFactory,
  stack,
  stackPiece,
} from '../../../support/variants/hexa-sort/sort-game';

// The Sort factory creates the whole family of Hexa Sort (issue 99, classes.md decision 31).

describe('SortFactory', () => {
  it('should_start_the_level_and_place_one_stack_when_the_sort_factory_builds_it', () => {
    const factory = sortFactory([stack('red', 'red'), stack('blue')]);

    const initial = factory.createInitialState();
    const { engine, publisher } = startVariant(factory);
    const outcome = engine.play(place(0, 0));

    expect(factory.gameId.value).toBe('hexa-sort');
    expect(factory.createBoard().shape.cells).toHaveLength(4);
    expect(initial.offered?.content.chips).toEqual(['red', 'red']);
    expect(initial.goalsNeeded).toBe(5);
    expect(outcome).toBe('playing');
    expect(chipsAt(engine, 0, 0)).toEqual(['red', 'red']);
    expect(engine.snapshot().offered?.content.chips).toEqual(['blue']);
    expect(engine.snapshot().score).toBe(0);
    expect(publisher.events).toEqual([]);
  });

  it('should_leave_the_level_source_unread_when_the_sort_factory_starts_two_games', () => {
    const source = new FixedListPieceSource([stack('red'), stack('blue')].map(stackPiece));
    const factory = new SortFactory(squareTopology, {
      size: RegionSize.of(2),
      source,
      goalsNeeded: 1,
    });

    const first = factory.createInitialState();
    const second = factory.createInitialState();

    expect(first.offered?.content.chips).toEqual(['red']);
    expect(second.offered?.content.chips).toEqual(['red']);
    expect(source.next().content.chips).toEqual(['red']);
  });
});
