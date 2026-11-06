import type { RandomSource } from './random-source';
import type { IRandomSeeded } from './random-seeded';
import { SeededRandom } from './seeded-random';

// Strategy and Iterator (classes.md decision 32). The variant factory picks the source,
// and a caller reads the pieces with `for...of`.
export interface IPieceSource<TPiece> extends Iterable<TPiece> {
  hasNext(): boolean;
  next(): TPiece;
  [Symbol.iterator](): Iterator<TPiece>;
}

// Reads a source until `hasNext()` is false. A caller that reads an endless source stops itself.
function* readAll<TPiece>(source: IPieceSource<TPiece>): Iterator<TPiece> {
  while (source.hasNext()) yield source.next();
}

// An endless source: `hasNext()` is always true. The seed fixes the sequence.
// So `[...source]` and `Array.from(source)` never return: a caller reads it with
// `for...of` and `break`, or with `next()`.
// `draw` turns the random source into one piece, so the variant decides what a piece is.
export class SeededPieceSource<TPiece> implements IPieceSource<TPiece>, IRandomSeeded {
  private readonly random: RandomSource;

  constructor(
    readonly seed: number,
    private readonly draw: (random: RandomSource) => TPiece,
  ) {
    this.random = new SeededRandom(seed);
  }

  hasNext(): boolean {
    return true;
  }

  next(): TPiece {
    return this.draw(this.random);
  }

  [Symbol.iterator](): Iterator<TPiece> {
    return readAll(this);
  }
}

// A finite source: it ends after its last piece, so the Fit tray is finite.
// It reads its list once: a second `for...of` gives no piece.
// A list that holds `undefined` throws a RangeError, because `undefined` is not a piece.
export class FixedListPieceSource<TPiece> implements IPieceSource<TPiece> {
  private readonly pieces: readonly TPiece[];
  private index = 0;

  constructor(pieces: readonly TPiece[]) {
    if (pieces.includes(undefined as TPiece)) {
      throw new RangeError('A piece list cannot hold undefined.');
    }
    this.pieces = [...pieces];
  }

  hasNext(): boolean {
    return this.index < this.pieces.length;
  }

  next(): TPiece {
    if (!this.hasNext()) throw new RangeError('The piece source has no piece left.');
    const piece = this.pieces[this.index] as TPiece;
    this.index += 1;
    return piece;
  }

  [Symbol.iterator](): Iterator<TPiece> {
    return readAll(this);
  }
}
