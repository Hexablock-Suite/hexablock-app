/** @jest-environment node */
import { TopologyId } from '../../../src/domain/shared/topology-id';
import type { ILevelBuilder } from '../../../src/domain/progress/level-builder';
import { LevelDefinition } from '../../../src/domain/progress/level-definition';
import { LevelId } from '../../../src/domain/progress/level-id';
import { fitLevelFile } from '../../support/variants/hexa-fit/fit-level-file';

// The data of one level file lives in layer 1, so a level builder can read it (issue #166,
// classes.md decision 24). The definition directs a builder: the topology, then the section.

// One step that a builder received, in the order of arrival.
type Step = { step: 'topology'; topology: TopologyId } | { step: 'section'; section: unknown };

// A builder double. It keeps each step, and it returns its steps as the level.
// A builder that changes the section it receives shows whether the definition shares it.
class RecordingBuilder implements ILevelBuilder<readonly Step[]> {
  private readonly steps: Step[] = [];

  constructor(private readonly changesTheSection = false) {}

  withTopology(topology: TopologyId): RecordingBuilder {
    this.steps.push({ step: 'topology', topology });
    return this;
  }

  withSection(section: unknown): RecordingBuilder {
    this.steps.push({ step: 'section', section: structuredClone(section) });
    if (this.changesTheSection) (section as { figure: unknown }).figure = 'changed';
    return this;
  }

  build(): readonly Step[] {
    return [...this.steps];
  }
}

describe('LevelDefinition', () => {
  it('should_give_the_topology_and_then_the_section_to_the_builder_when_the_definition_directs_it', () => {
    const file = fitLevelFile();
    const definition = LevelDefinition.of(file);

    const steps = definition.buildWith(new RecordingBuilder());

    expect(steps).toEqual([
      { step: 'topology', topology: TopologyId.hex },
      { step: 'section', section: fitLevelFile().section },
    ]);
  });

  it('should_give_each_builder_the_section_of_the_file_when_a_builder_or_the_caller_changes_a_section', () => {
    const file = fitLevelFile();
    const definition = LevelDefinition.of(file);

    file.section.figure.push([3, 0]);
    definition.buildWith(new RecordingBuilder(true));
    const steps = definition.buildWith(new RecordingBuilder());

    expect(steps[1]).toEqual({ step: 'section', section: fitLevelFile().section });
  });

  it('should_throw_a_range_error_when_the_level_file_names_an_unknown_topology', () => {
    const create = () => LevelDefinition.of({ ...fitLevelFile(), topology: 'hexagon' });

    expect(create).toThrow(new RangeError('Unknown topology: hexagon.'));
  });

  // Only a cast or a broken file leaves the section out.
  it('should_throw_a_range_error_when_the_level_file_has_no_section', () => {
    const create = () => LevelDefinition.of({ ...fitLevelFile(), section: undefined });

    expect(create).toThrow(new RangeError('A level file needs a section.'));
  });

  it('should_be_equal_only_when_two_definitions_hold_the_same_topology_and_section', () => {
    const one = LevelDefinition.of(fitLevelFile());
    const same = LevelDefinition.of(fitLevelFile());
    const square = LevelDefinition.of({ ...fitLevelFile(), topology: 'square' });
    const other = LevelDefinition.of({ ...fitLevelFile(), section: { figure: [[0, 0]] } });

    expect([one.equals(same), same.equals(one)]).toEqual([true, true]);
    expect([one.equals(square), square.equals(one)]).toEqual([false, false]);
    expect([one.equals(other), other.equals(one)]).toEqual([false, false]);
  });

  // Issue #168: the list of levels reads the level id and the order of the common part.
  it('should_not_be_equal_when_two_definitions_hold_another_level_id_or_another_order', () => {
    const one = LevelDefinition.of(fitLevelFile());
    const otherId = LevelDefinition.of({ ...fitLevelFile(), levelId: 'fit-09' });
    const otherOrder = LevelDefinition.of({ ...fitLevelFile(), order: 9 });

    expect([one.equals(otherId), otherId.equals(one)]).toEqual([false, false]);
    expect([one.equals(otherOrder), otherOrder.equals(one)]).toEqual([false, false]);
  });

  it('should_give_the_level_id_of_the_file_when_the_list_of_levels_asks_for_it', () => {
    const definition = LevelDefinition.of(fitLevelFile());

    expect(definition.levelId().equals(LevelId.of('fit-01'))).toBe(true);
    expect(definition.levelId().equals(LevelId.of('fit-02'))).toBe(false);
  });

  // S3-08 in #151: a level is played only on the figure that its topology names.
  it('should_be_played_only_on_the_figure_of_its_topology_when_a_figure_is_asked', () => {
    const figures = [TopologyId.hex, TopologyId.square, TopologyId.triangle];
    const hexLevel = LevelDefinition.of(fitLevelFile());
    const squareLevel = LevelDefinition.of({ ...fitLevelFile(), topology: 'square' });

    expect(figures.map((figure) => hexLevel.isPlayedOn(figure))).toEqual([true, false, false]);
    expect(figures.map((figure) => squareLevel.isPlayedOn(figure))).toEqual([false, true, false]);
  });

  // S3-12 in #151: the `order` of the file places the level in the list of its game.
  it('should_come_before_only_a_level_of_a_higher_order_when_two_definitions_are_compared', () => {
    const first = LevelDefinition.of(fitLevelFile());
    const second = LevelDefinition.of({ ...fitLevelFile(), levelId: 'fit-02', order: 2 });
    const tie = LevelDefinition.of({ ...fitLevelFile(), levelId: 'fit-01-b', order: 1 });

    expect([first.comesBefore(second), second.comesBefore(first)]).toEqual([true, false]);
    expect([first.comesBefore(tie), tie.comesBefore(first)]).toEqual([false, false]);
  });

  // The level format: the order is a whole number of 1 or more. The error carries the order.
  it('should_throw_a_range_error_when_the_order_of_the_file_is_not_a_whole_number_of_1_or_more', () => {
    for (const order of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const create = () => LevelDefinition.of({ ...fitLevelFile(), order });

      expect(create).toThrow(
        new RangeError('A level order needs a whole number of 1 or more.', { cause: order }),
      );
    }
  });

  it('should_throw_a_range_error_when_the_level_id_of_the_file_is_blank', () => {
    const create = () => LevelDefinition.of({ ...fitLevelFile(), levelId: '  ' });

    expect(create).toThrow(new RangeError('A level id cannot be empty.'));
  });

  // Issue #48, DS-6: the version of the level format is a whole number of 1 or more.
  // The error carries the version. Only a cast or a broken file leaves the version out.
  it('should_throw_a_range_error_when_the_version_of_the_file_is_not_a_whole_number_of_1_or_more', () => {
    for (const version of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
      const create = () =>
        LevelDefinition.of({ ...fitLevelFile(), version: version as unknown as number });

      expect(create).toThrow(
        new RangeError('A level version needs a whole number of 1 or more.', { cause: version }),
      );
    }
  });

  // Issue #48: two copies of one level with two versions are two definitions.
  it('should_not_be_equal_when_two_definitions_hold_another_version', () => {
    const one = LevelDefinition.of(fitLevelFile());
    const newer = LevelDefinition.of({ ...fitLevelFile(), version: 2 });

    expect([one.equals(newer), newer.equals(one)]).toEqual([false, false]);
  });

  // DS-11, issue #48: the copy of a level with the higher version wins. An equal version
  // does not replace a copy, and a copy of another level never replaces it.
  it('should_replace_a_copy_of_the_same_level_only_when_its_version_is_higher', () => {
    const first = LevelDefinition.of(fitLevelFile());
    const second = LevelDefinition.of({ ...fitLevelFile(), version: 2 });
    const same = LevelDefinition.of(fitLevelFile());
    const otherLevel = LevelDefinition.of({ ...fitLevelFile(), levelId: 'fit-02', version: 3 });

    expect([second.replaces(first), first.replaces(second)]).toEqual([true, false]);
    expect([same.replaces(first), first.replaces(same)]).toEqual([false, false]);
    expect([otherLevel.replaces(first), first.replaces(otherLevel)]).toEqual([false, false]);
  });
});
