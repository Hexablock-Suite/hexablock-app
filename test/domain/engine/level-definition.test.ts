/** @jest-environment node */
import { TopologyId } from '../../../src/domain/engine/geometry-factory';
import type { ILevelBuilder } from '../../../src/domain/engine/level-builder';
import { LevelDefinition } from '../../../src/domain/engine/level-definition';
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
});
