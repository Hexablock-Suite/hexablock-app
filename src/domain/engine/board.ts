import type { BoardShape } from './board-shape';
import type { Cloneable } from './cloneable';
import type { CoordKey } from './coord-key';
import type { GridTopology } from './grid-topology';
import type { Radius } from './radius';

// A space of the board: the place that a player sees as free or as occupied.
// It is an entity (classes.md decision 39). The key of its coordinate is its identity.
// That key never changes. The state is the cell that occupies the space, or none when free.
// A cell is a value. The copy of a space shares the cell object with the original space.
// `TCell` can include `undefined`. So the state holds the cell in an object:
// a free space has no object, and a space with an `undefined` cell has one.
export class BoardSpace<TCell, TCoord> implements Cloneable<BoardSpace<TCell, TCoord>> {
  private constructor(
    private readonly identity: CoordKey,
    private readonly at: TCoord,
    private occupant: { readonly cell: TCell } | undefined,
  ) {}

  // A new space is free. The topology gives the identity of the coordinate.
  static free<TCell, TCoord>(
    at: TCoord,
    topology: { key(c: TCoord): CoordKey },
  ): BoardSpace<TCell, TCoord> {
    return new BoardSpace<TCell, TCoord>(topology.key(at), at, undefined);
  }

  // Two spaces with one identity are the same space. Their states and their objects do not count.
  equals(other: BoardSpace<TCell, TCoord>): boolean {
    return this.identity === other.identity;
  }

  // A free space becomes occupied. An occupied space takes the new cell.
  occupy(cell: TCell): void {
    this.occupant = { cell };
  }

  // Tells who occupies this space: a new pair of the coordinate and the cell, or none when free.
  // A caller cannot change the space through the pair.
  occupation(): [TCoord, TCell] | undefined {
    return this.occupant === undefined ? undefined : [this.at, this.occupant.cell];
  }

  // The copy has the same identity and its own state.
  clone(): BoardSpace<TCell, TCoord> {
    return new BoardSpace<TCell, TCoord>(this.identity, this.at, this.occupant);
  }
}

// The generic board: the `HexBoard<TCell>` of statement §3.1 with a generic coordinate.
// Iterator: `line()`, `ring()` and `neighborhood()` walk the board lazily.
// Prototype: `clone()` takes the snapshot for undo (classes.md decision 7).
// The board asks its topology for every coordinate (classes.md decision 16).
// Each written coordinate has one `BoardSpace`. The board gives no caller a space.
// A cell is a value. The board copies the references to the cells, never the cells.
// So `clone()` copies each space and shares the cell objects with the original board.
// A caller must not change a cell object. To change a cell, the caller sets a new cell.
// A space exists from its first write. So `cells()` lists the cells in first-write order.
// Each coordinate of the shape has its own topology key. Two equal keys are an error.
// The initial content is checked like `set()`: each entry lies inside the shape,
// and its key is the topology key of its coordinate. The board keeps no pair of a caller.
// `TAxis` is the axis union of the topology. The board reads no direction,
// so it takes a topology with any direction union.
export class Board<TCell, TCoord, TAxis extends string> implements Cloneable<
  Board<TCell, TCoord, TAxis>
> {
  private readonly inside: ReadonlySet<CoordKey>;
  private readonly content: Map<CoordKey, BoardSpace<TCell, TCoord>>;

  constructor(
    readonly shape: BoardShape<TCoord>,
    readonly topology: GridTopology<TCoord, TAxis, string>,
    content: ReadonlyMap<CoordKey, [TCoord, TCell]> = new Map(),
  ) {
    this.inside = new Set(shape.cells.map((c) => topology.key(c)));
    if (this.inside.size !== shape.cells.length) {
      throw new RangeError('Two coordinates of the shape have the same key.');
    }
    this.content = new Map();
    for (const [key, [c, cell]] of content) {
      const expected = topology.key(c);
      if (key !== expected) {
        throw new RangeError(
          `The key ${key} does not match the key ${expected} of its coordinate.`,
        );
      }
      if (!this.inside.has(expected)) {
        throw new RangeError(`The coordinate ${expected} is outside the board.`);
      }
      this.occupySpace(expected, c, cell);
    }
  }

  contains(c: TCoord): boolean {
    return this.inside.has(this.topology.key(c));
  }

  get(at: TCoord): TCell | undefined {
    return this.content.get(this.topology.key(at))?.occupation()?.[1];
  }

  // Changes the board in place. A coordinate outside the shape is an error.
  set(c: TCoord, cell: TCell): void {
    if (!this.contains(c)) {
      throw new RangeError(`The coordinate ${this.topology.key(c)} is outside the board.`);
    }
    this.occupySpace(this.topology.key(c), c, cell);
  }

  // The filled cells as new pairs, so a caller cannot change the board through them.
  cells(): [TCoord, TCell][] {
    return [...this.content.values()].flatMap((space) => {
      const occupation = space.occupation();
      return occupation === undefined ? [] : [occupation];
    });
  }

  // A line through a coordinate outside the shape is empty.
  *line(axis: TAxis, through: TCoord): Iterable<TCoord> {
    if (!this.contains(through)) return;
    yield* this.topology.line(axis, through, (c) => this.contains(c));
  }

  *ring(center: TCoord, radius: Radius): Iterable<TCoord> {
    for (const c of this.topology.ring(center, radius)) {
      if (this.contains(c)) yield c;
    }
  }

  *neighborhood(c: TCoord): Iterable<TCoord> {
    for (const n of this.topology.neighbors(c)) {
      if (this.contains(n)) yield n;
    }
  }

  clone(): Board<TCell, TCoord, TAxis> {
    const copy = new Board<TCell, TCoord, TAxis>(this.shape, this.topology);
    for (const [key, space] of this.content) copy.content.set(key, space.clone());
    return copy;
  }

  // `Map.set` keeps the place of a key that exists. So the first write fixes the order.
  private occupySpace(key: CoordKey, c: TCoord, cell: TCell): void {
    const space = this.content.get(key) ?? BoardSpace.free<TCell, TCoord>(c, this.topology);
    space.occupy(cell);
    this.content.set(key, space);
  }
}
