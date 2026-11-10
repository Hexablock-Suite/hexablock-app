/** @jest-environment node */
import { TopologyId } from '../../../src/domain/engine/geometry-factory';
import { hex, HexAxis, HexDirection, HexTopology } from '../../../src/domain/engine/hex-topology';
import { Outcome } from '../../../src/domain/engine/outcome';
import {
  square,
  SquareAxis,
  SquareDirection,
  SquareTopology,
} from '../../../src/domain/engine/square-topology';
import {
  triangle,
  TriangleAxis,
  TriangleDirection,
  TriangleTopology,
} from '../../../src/domain/engine/triangle-topology';

// Issue #207 (classes.md decision 45): a closed union of texts is a class with a closed set
// of instances. Each row holds one class of the engine, its instances and their texts.
interface Member {
  equals(other: never): boolean;
  toString(): string;
}

type Row = readonly [name: string, type: object, members: readonly Member[], texts: string[]];

const table: readonly Row[] = [
  [
    'Outcome',
    Outcome,
    [Outcome.playing, Outcome.victory, Outcome.gameOver],
    ['playing', 'victory', 'game-over'],
  ],
  [
    'TopologyId',
    TopologyId,
    [TopologyId.hex, TopologyId.square, TopologyId.triangle],
    ['hex', 'square', 'triangle'],
  ],
  ['HexAxis', HexAxis, [HexAxis.q, HexAxis.r, HexAxis.s], ['q', 'r', 's']],
  [
    'HexDirection',
    HexDirection,
    [
      HexDirection.east,
      HexDirection.west,
      HexDirection.southEast,
      HexDirection.northWest,
      HexDirection.southWest,
      HexDirection.northEast,
    ],
    ['east', 'west', 'south-east', 'north-west', 'south-west', 'north-east'],
  ],
  ['SquareAxis', SquareAxis, [SquareAxis.col, SquareAxis.row], ['col', 'row']],
  [
    'SquareDirection',
    SquareDirection,
    [SquareDirection.north, SquareDirection.east, SquareDirection.south, SquareDirection.west],
    ['north', 'east', 'south', 'west'],
  ],
  [
    'TriangleAxis',
    TriangleAxis,
    [TriangleAxis.row, TriangleAxis.downRight, TriangleAxis.downLeft],
    ['row', 'down-right', 'down-left'],
  ],
  [
    'TriangleDirection',
    TriangleDirection,
    [TriangleDirection.left, TriangleDirection.right, TriangleDirection.vertical],
    ['left', 'right', 'vertical'],
  ],
];

// The instances that a class holds in its static members.
function instancesOf(type: object): unknown[] {
  return Object.values(type).filter((value) => value instanceof (type as () => void));
}

describe.each(table)('closed set %s', (_name, type, members, texts) => {
  it('should_hold_exactly_the_instances_of_the_union_when_the_class_is_read', () => {
    expect(members.every((member) => member instanceof (type as () => void))).toBe(true);
    expect(instancesOf(type)).toEqual(members);
    expect(new Set(members).size).toBe(texts.length);
    expect(members.map(String)).toEqual(texts);
  });

  it('should_throw_a_range_error_when_a_cast_calls_the_constructor', () => {
    const forge = () => Reflect.construct(type as () => void, ['forged']);

    expect(forge).toThrow(RangeError);
    expect(instancesOf(type)).toHaveLength(members.length);
  });

  it('should_refuse_the_write_when_a_cast_writes_a_field_of_an_instance', () => {
    for (const member of members) {
      expect(Object.isFrozen(member)).toBe(true);
      expect(Reflect.set(member, 'name', 'forged')).toBe(false);
    }
    expect(members.map(String)).toEqual(texts);
  });

  it('should_be_equal_when_two_instances_have_one_name', () => {
    for (const member of members) {
      expect(member.equals(member as never)).toBe(true);
    }
  });

  it('should_not_be_equal_when_two_instances_have_two_names', () => {
    for (const member of members) {
      const others = members.filter((other) => other !== member);

      expect(others.map((other) => member.equals(other as never))).toEqual(others.map(() => false));
    }
  });
});

describe('TopologyId', () => {
  it('should_give_the_shared_instance_when_a_text_names_a_topology', () => {
    expect(TopologyId.of('hex')).toBe(TopologyId.hex);
    expect(TopologyId.of('square')).toBe(TopologyId.square);
    expect(TopologyId.of('triangle')).toBe(TopologyId.triangle);
  });

  // A level file keeps the text. The inherited names of an object are not topologies.
  it('should_throw_a_range_error_when_a_text_names_an_unknown_topology', () => {
    for (const name of ['cube', '', 'Hex', 'constructor', '__proto__']) {
      expect(() => TopologyId.of(name)).toThrow(new RangeError(`Unknown topology: ${name}.`));
    }
  });
});

describe('the axes and the directions of a topology', () => {
  it('should_give_its_axis_and_direction_instances_when_a_topology_is_read', () => {
    expect(new HexTopology().axes()).toEqual([HexAxis.q, HexAxis.r, HexAxis.s]);
    expect(new HexTopology().directions()).toEqual([
      HexDirection.east,
      HexDirection.west,
      HexDirection.southEast,
      HexDirection.northWest,
      HexDirection.southWest,
      HexDirection.northEast,
    ]);
    expect(new SquareTopology().axes()).toEqual([SquareAxis.col, SquareAxis.row]);
    expect(new SquareTopology().directions()).toEqual([
      SquareDirection.north,
      SquareDirection.east,
      SquareDirection.south,
      SquareDirection.west,
    ]);
    expect(new TriangleTopology().axes()).toEqual([
      TriangleAxis.row,
      TriangleAxis.downRight,
      TriangleAxis.downLeft,
    ]);
    expect(new TriangleTopology().directions()).toEqual([
      TriangleDirection.left,
      TriangleDirection.right,
      TriangleDirection.vertical,
    ]);
  });

  it('should_give_the_next_and_the_previous_cell_when_an_axis_steps_from_a_cell', () => {
    expect(HexAxis.q.forward(hex(1, 1))).toEqual(hex(2, 1));
    expect(HexAxis.r.forward(hex(1, 1))).toEqual(hex(1, 2));
    expect(HexAxis.s.forward(hex(1, 1))).toEqual(hex(2, 0));
    expect(HexAxis.s.backward(hex(1, 1))).toEqual(hex(0, 2));
    expect(SquareAxis.col.forward(square(1, 1))).toEqual(square(2, 1));
    expect(SquareAxis.row.forward(square(1, 1))).toEqual(square(1, 2));
    expect(SquareAxis.row.backward(square(1, 1))).toEqual(square(1, 0));
    // A diagonal axis of the triangle grid zigzags: the step depends on the orientation.
    expect(TriangleAxis.row.forward(triangle(0, 0))).toEqual(triangle(1, 0));
    expect(TriangleAxis.downRight.forward(triangle(0, 0))).toEqual(triangle(0, 1));
    expect(TriangleAxis.downRight.forward(triangle(1, 0))).toEqual(triangle(2, 0));
    expect(TriangleAxis.downLeft.backward(triangle(0, 0))).toEqual(triangle(1, 0));
    expect(TriangleAxis.downLeft.backward(triangle(1, 0))).toEqual(triangle(1, -1));
  });

  it('should_give_the_neighbor_when_a_direction_steps_from_a_cell', () => {
    expect(HexDirection.northEast.neighborOf(hex(1, 1))).toEqual(hex(2, 0));
    expect(SquareDirection.north.neighborOf(square(1, 1))).toEqual(square(1, 0));
    expect(TriangleDirection.vertical.neighborOf(triangle(0, 0))).toEqual(triangle(0, 1));
    expect(TriangleDirection.vertical.neighborOf(triangle(1, 0))).toEqual(triangle(1, -1));
  });

  it('should_throw_a_range_error_when_a_line_follows_an_axis_of_another_topology', () => {
    const read = () => [
      ...new HexTopology().line(SquareAxis.col as unknown as HexAxis, hex(0, 0), () => false),
    ];

    expect(read).toThrow(new RangeError('The hex grid has no axis col.'));
  });

  it('should_throw_a_range_error_when_a_neighbor_follows_a_direction_of_another_topology', () => {
    const follow = () =>
      new SquareTopology().neighbor(square(0, 0), HexDirection.east as unknown as SquareDirection);

    expect(follow).toThrow(new RangeError('The square grid has no direction east.'));
  });
});
