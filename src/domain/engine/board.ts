import type { BoardId } from './board-id';
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

  // An occupied space becomes free. A free space throws a RangeError and stays free.
  vacate(): void {
    if (this.occupant === undefined) {
      throw new RangeError(`The space ${this.identity} is already free.`);
    }
    this.occupant = undefined;
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

// The read-only side of a board. The photo of a state holds its board through this type
// (classes.md decision 34), so a reader of the photo can ask the board questions and cannot
// change it. The photo holds a copy, so a change through a cast never reaches the state.
// `clone()` gives a new board that the caller owns.
export interface ReadonlyBoard<TCell, TCoord, TAxis extends string> {
  readonly shape: BoardShape<TCoord>;
  readonly topology: GridTopology<TCoord, TAxis, string>;
  equals(other: ReadonlyBoard<TCell, TCoord, TAxis>): boolean;
  contains(c: TCoord): boolean;
  get(at: TCoord): TCell | undefined;
  cells(): [TCoord, TCell][];
  line(axis: TAxis, through: TCoord): Iterable<TCoord>;
  ring(center: TCoord, radius: Radius): Iterable<TCoord>;
  neighborhood(c: TCoord): Iterable<TCoord>;
  clone(): Board<TCell, TCoord, TAxis>;
}

// The generic board: the `HexBoard<TCell>` of statement §3.1 with a generic coordinate.
// Iterator: `line()`, `ring()` and `neighborhood()` walk the board lazily.
// Prototype: `clone()` takes the snapshot for undo (classes.md decision 7).
// The board asks its topology for every coordinate (classes.md decision 16).
// Each written coordinate has one `BoardSpace`. The board gives no caller a space.
// A cell is a value. The board copies the references to the cells, never the cells.
// So `clone()` copies each space and shares the cell objects with the original board.
// A caller must not change a cell object. To change a cell, a new cell occupies the coordinate.
// The board is an entity inside the state (classes.md decision 7). Its `BoardId` is its identity.
// The id never changes, and `equals()` compares two boards by it. The cells do not count.
// A `BoardIdGenerator` gives the id of each new board, and `clone()` keeps it:
// the copy is the same board at an earlier moment.
// The board changes in place, and only through two business intentions: `occupy()` and `vacate()`.
// `restore()` takes back the cells of an earlier copy of the same board, for the undo.
// A space exists from its first write. So `cells()` lists the cells in first-write order.
// A vacated space is free. When a cell occupies it again, that write counts as a first write.
// So `cells()` gives the same order as a board built again from the cells that stay.
// Each coordinate of the shape has its own topology key. Two equal keys are an error.
// The initial content is checked like `occupy()`: each entry lies inside the shape,
// and its key is the topology key of its coordinate. The board keeps no pair of a caller.
// `TAxis` is the axis union of the topology. The board reads no direction,
// so it takes a topology with any direction union.
export class Board<TCell, TCoord, TAxis extends string>
  implements ReadonlyBoard<TCell, TCoord, TAxis>, Cloneable<Board<TCell, TCoord, TAxis>>
{
  private readonly inside: ReadonlySet<CoordKey>;
  private readonly content: Map<CoordKey, BoardSpace<TCell, TCoord>>;

  constructor(
    private readonly identity: BoardId,
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

  // Two boards with one id are the same board. Their cells and their objects do not count.
  equals(other: ReadonlyBoard<TCell, TCoord, TAxis>): boolean {
    return other instanceof Board && this.identity.equals(other.identity);
  }

  contains(c: TCoord): boolean {
    return this.inside.has(this.topology.key(c));
  }

  get(at: TCoord): TCell | undefined {
    return this.content.get(this.topology.key(at))?.occupation()?.[1];
  }

  // The cell occupies the coordinate, free or occupied. A coordinate outside the shape
  // throws a RangeError and leaves the board unchanged.
  occupy(c: TCoord, cell: TCell): void {
    this.occupySpace(this.insideKey(c), c, cell);
  }

  // The coordinate becomes free. A coordinate outside the shape, or a free coordinate,
  // throws a RangeError and leaves the board unchanged.
  vacate(c: TCoord): void {
    const key = this.insideKey(c);
    const space = this.content.get(key);
    if (space?.occupation() === undefined) {
      throw new RangeError(`The coordinate ${key} is already free.`);
    }
    space.vacate();
  }

  // Takes back the cells of `earlier`, an earlier copy of this board, in their order.
  // Every space becomes free, and then each cell of `earlier` occupies its coordinate again.
  // So `cells()` gives the cells of `earlier` in the same order.
  // A copy of another board, or a cell outside the shape, throws a RangeError before any change.
  restore(earlier: ReadonlyBoard<TCell, TCoord, TAxis>): void {
    if (!this.equals(earlier)) {
      throw new RangeError('A board takes back only the cells of its own copy.');
    }
    const cells = earlier.cells();
    const keys = cells.map(([c]) => this.insideKey(c));
    for (const space of this.content.values()) {
      if (space.occupation() !== undefined) space.vacate();
    }
    cells.forEach(([c, cell], i) => this.occupySpace(keys[i] as CoordKey, c, cell));
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
    const copy = new Board<TCell, TCoord, TAxis>(this.identity, this.shape, this.topology);
    for (const [key, space] of this.content) copy.content.set(key, space.clone());
    return copy;
  }

  // The key of a coordinate inside the shape. Any other coordinate throws a RangeError.
  private insideKey(c: TCoord): CoordKey {
    const key = this.topology.key(c);
    if (!this.inside.has(key)) throw new RangeError(`The coordinate ${key} is outside the board.`);
    return key;
  }

  // `Map.set` keeps the place of a key that exists. So the first write fixes the order.
  // A free space leaves the map before it takes the cell, so it goes to the end of the order.
  private occupySpace(key: CoordKey, c: TCoord, cell: TCell): void {
    const space = this.content.get(key) ?? BoardSpace.free<TCell, TCoord>(c, this.topology);
    if (space.occupation() === undefined) this.content.delete(key);
    space.occupy(cell);
    this.content.set(key, space);
  }
}
