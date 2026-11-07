import type { PieceId } from './piece-id';

// Wrong on purpose: a variant declares a board class that extends nothing (APP-NFR-01).
export class FitBoard<TCoord> {
  private readonly cells = new Map<string, [TCoord, PieceId]>();

  get(key: string): PieceId | undefined {
    return this.cells.get(key)?.[1];
  }
}
