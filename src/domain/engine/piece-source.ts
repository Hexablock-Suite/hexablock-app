import type { RandomSource } from './random-source';
import type { IRandomSeeded } from './random-seeded';
import { Mulberry32Random } from './mulberry32-random';

// One draw of a source: the piece, and the source that gives the pieces after it.
export interface PieceDraw<TPiece> {
  readonly piece: TPiece;
  readonly rest: IPieceSource<TPiece>;
}

// Strategy and Iterator (classes.md decision 32). The variant factory picks the source,
// and a caller reads the pieces with `for...of`.
// A source is a value object (classes.md decision 51): no operation changes it.
// `take()` returns the next piece and the next source, and the source stays at its position.
// So two calls of `take()` on one source give the same piece.
// A state that draws keeps `rest` in place of its source (classes.md decision 31).
// A state, its photo and its copy share one source, and none of them copies it.
// `for...of` reads the pieces from the position of the source and changes nothing,
// so a second `for...of` gives the same pieces.
export interface IPieceSource<TPiece> extends Iterable<TPiece> {
  hasNext(): boolean;
  take(): PieceDraw<TPiece>;
  [Symbol.iterator](): Iterator<TPiece>;
}

// The pieces of a source from its position, until `hasNext()` is false.
// It follows `rest` from draw to draw, so it changes no source.
// A caller that reads an endless source stops itself.
export function* piecesFrom<TPiece>(source: IPieceSource<TPiece>): Iterator<TPiece> {
  let current = source;
  while (current.hasNext()) {
    const { piece, rest } = current.take();
    yield piece;
    current = rest;
  }
}

// An endless source: `hasNext()` is always true. The seed fixes the sequence.
// So `[...source]` and `Array.from(source)` never return: a caller reads it with
// `for...of` and `break`, or with `take()`.
// `draw` turns the random source into one piece, so the variant decides what a piece is.
// `take()` clones the random source and draws from the clone. It does not replay the draws.
// The next source holds the clone, so this source keeps its generator state.
export class SeededPieceSource<TPiece> implements IPieceSource<TPiece>, IRandomSeeded {
  private random: RandomSource;

  constructor(
    readonly seed: number,
    private readonly draw: (random: RandomSource) => TPiece,
  ) {
    this.random = new Mulberry32Random(seed);
  }

  hasNext(): boolean {
    return true;
  }

  take(): { readonly piece: TPiece; readonly rest: SeededPieceSource<TPiece> } {
    const random = this.random.clone();
    const piece = this.draw(random);
    // The next source is new, so the write of its generator changes no source in use.
    const rest = new SeededPieceSource(this.seed, this.draw);
    rest.random = random;
    return { piece, rest };
  }

  [Symbol.iterator](): Iterator<TPiece> {
    return piecesFrom(this);
  }
}

// A finite source: it ends after its last piece, so the Fit tray is finite.
// `take()` at the end throws a RangeError.
// The source copies its list once and freezes the copy. Each next source shares that copy.
// A list that holds `undefined` throws a RangeError, because `undefined` is not a piece.
export class FixedListPieceSource<TPiece> implements IPieceSource<TPiece> {
  private pieces: readonly TPiece[];
  private index = 0;

  constructor(pieces: readonly TPiece[]) {
    if (pieces.includes(undefined as TPiece)) {
      throw new RangeError('A piece list cannot hold undefined.');
    }
    this.pieces = Object.freeze([...pieces]);
  }

  hasNext(): boolean {
    return this.index < this.pieces.length;
  }

  take(): { readonly piece: TPiece; readonly rest: FixedListPieceSource<TPiece> } {
    if (!this.hasNext()) throw new RangeError('The piece source has no piece left.');
    const piece = this.pieces[this.index] as TPiece;
    // The next source is new, so the writes of its list and position change no source in use.
    const rest = new FixedListPieceSource<TPiece>([]);
    rest.pieces = this.pieces;
    rest.index = this.index + 1;
    return { piece, rest };
  }

  [Symbol.iterator](): Iterator<TPiece> {
    return piecesFrom(this);
  }
}
