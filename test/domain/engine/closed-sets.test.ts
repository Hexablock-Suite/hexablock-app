/** @jest-environment node */
import { TopologyId } from '../../../src/domain/shared/topology-id';
import { hex, HexAxis, HexTopology } from '../../../src/domain/engine/geometry/hex-topology';
import { Outcome } from '../../../src/domain/engine/events/outcome';
import {
  square,
  SquareAxis,
  SquareTopology,
} from '../../../src/domain/engine/geometry/square-topology';
import {
  triangle,
  TriangleAxis,
  TriangleTopology,
} from '../../../src/domain/engine/geometry/triangle-topology';
import * as hexFile from '../../../src/domain/engine/geometry/hex-topology';
import * as squareFile from '../../../src/domain/engine/geometry/square-topology';
import * as triangleFile from '../../../src/domain/engine/geometry/triangle-topology';
import type { ValueReceiver } from '../../../src/domain/shared/value-receiver';
import { deliveries, RecordingReceiver } from '../../support/engine/value-receiver';

// Issue #207 (classes.md decision 45): a closed union of texts is a class with a closed set
// of instances. Each row holds one class of the engine, its instances and their texts.
interface Member {
  equals(other: never): boolean;
  deliverTo(receiver: ValueReceiver<string>): void;
}

// The text that each member delivers to a receiver.
const textsOf = (members: readonly Member[]) => members.map((member) => deliveries(member));

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
  ['SquareAxis', SquareAxis, [SquareAxis.col, SquareAxis.row], ['col', 'row']],
  [
    'TriangleAxis',
    TriangleAxis,
    [TriangleAxis.row, TriangleAxis.downRight, TriangleAxis.downLeft],
    ['row', 'down-right', 'down-left'],
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
    expect(textsOf(members)).toEqual(texts.map((text) => [text]));
  });

  // Issue #237: the text leaves a member only through a receiver (rule R-no-delivery-call).
  it('should_deliver_its_text_once_and_return_nothing_when_a_receiver_takes_it', () => {
    for (const [index, member] of members.entries()) {
      const receiver = new RecordingReceiver<string>();

      const returned: void = member.deliverTo(receiver);

      expect(returned).toBeUndefined();
      expect(receiver.received()).toEqual([texts[index]]);
    }
  });

  // Issue #237: no operation returns the text, `toString()` included.
  it('should_give_no_text_when_a_template_literal_or_string_converts_a_member', () => {
    expect(members.map((member) => `${String(member)}`)).toEqual(
      members.map(() => '[object Object]'),
    );
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
    expect(textsOf(members)).toEqual(texts.map((text) => [text]));
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

describe('the axes and the neighbors of a topology', () => {
  // Issue #416 (decision 16): a slide is an axis and a sense, so no topology names a direction.
  // Each direction class stays private to the file of its topology, for `neighbors()`.
  it('should_offer_no_direction_when_a_topology_or_the_file_of_its_topology_is_read', () => {
    const topologies = [new HexTopology(), new SquareTopology(), new TriangleTopology()];
    const files = [hexFile, squareFile, triangleFile];

    expect(
      topologies.map((topology) => [
        Reflect.has(topology, 'neighbor'),
        Reflect.has(topology, 'directions'),
      ]),
    ).toEqual(topologies.map(() => [false, false]));
    expect(
      files.flatMap((file) => Object.keys(file)).filter((name) => /Direction/.test(name)),
    ).toEqual([]);
  });

  it('should_give_its_axis_instances_when_a_topology_is_read', () => {
    expect(new HexTopology().axes()).toEqual([HexAxis.q, HexAxis.r, HexAxis.s]);
    expect(new SquareTopology().axes()).toEqual([SquareAxis.col, SquareAxis.row]);
    expect(new TriangleTopology().axes()).toEqual([
      TriangleAxis.row,
      TriangleAxis.downRight,
      TriangleAxis.downLeft,
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

  // Each private direction of a topology gives one neighbor, in the order of `neighbors()`.
  it('should_give_one_neighbor_per_direction_in_order_when_the_neighbors_of_a_cell_are_read', () => {
    expect(new HexTopology().neighbors(hex(1, 1))).toEqual([
      hex(2, 1),
      hex(2, 0),
      hex(1, 0),
      hex(0, 1),
      hex(0, 2),
      hex(1, 2),
    ]);
    expect(new SquareTopology().neighbors(square(1, 1))).toEqual([
      square(1, 0),
      square(2, 1),
      square(1, 2),
      square(0, 1),
    ]);
    // The `vertical` neighbor lies below an up triangle and above a down triangle.
    expect(new TriangleTopology().neighbors(triangle(0, 0))).toEqual([
      triangle(-1, 0),
      triangle(1, 0),
      triangle(0, 1),
    ]);
    expect(new TriangleTopology().neighbors(triangle(1, 0))).toEqual([
      triangle(0, 0),
      triangle(2, 0),
      triangle(1, -1),
    ]);
  });

  // Issue #237: the error carries the axis of the other topology as its `cause`,
  // and the edge delivers its text.
  it('should_throw_a_range_error_that_carries_the_axis_when_a_line_follows_an_axis_of_another_topology', () => {
    const read = () => [
      ...new HexTopology().line(SquareAxis.col as unknown as HexAxis, hex(0, 0), () => false),
    ];

    expect(read).toThrow(
      new RangeError('The hex grid has no such axis.', { cause: SquareAxis.col }),
    );
  });
});
