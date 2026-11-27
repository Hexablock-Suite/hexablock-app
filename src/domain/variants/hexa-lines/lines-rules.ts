import type { ReadonlyBoard } from '../../engine/board';
import type { Color } from '../../engine/color';
import { CoordKey } from '../../engine/coord-key';
import { Outcome } from '../../engine/outcome';
import { Resolution } from '../../engine/resolution';
import { BaseGameRules } from '../../engine/rules';
import type { LinesState } from './lines-state';
import { PlacePiece } from './place-piece';
import { TrayPosition } from './tray-position';

// The rules of Hexa Lines (statement §1.1). The rules ask the topology for the axes,
// so they never hard-code 3 axes or 6 directions (D4).
// Hexa Lines has no gravity (REQUIREMENTS.md §8). A cleared cell stays empty, and no cell moves.
// The rules decide. The state changes itself: the rules call `placePiece()` and `clearLines()`.
// The rules ask the photo of the state and `canPlace()`, and they read no field.
// The rules read no field of a move: they pass the move to the state (classes.md decision 43).
// The `TrayPosition` of a `PlacePiece` checks its own index, so the rules do not check it again.
export class LinesRules<TCoord> extends BaseGameRules<PlacePiece<TCoord>, LinesState<TCoord>> {
  protected isValid(state: LinesState<TCoord>, move: PlacePiece<TCoord>): boolean {
    return state.canPlace(move);
  }

  // A lazy generator: align one cell of each tray piece with each reachable free space.
  // The «no tray piece fits» end reads only its first move (classes.md decision 33).
  *validMoves(state: LinesState<TCoord>): Iterable<PlacePiece<TCoord>> {
    const photo = state.snapshot();
    const board = photo.boardCopy();
    for (const [index, piece] of photo.trayPieces().entries()) {
      const position = TrayPosition.of(index);
      const [anchor] = piece.coveredCoordinates();
      const offsets =
        anchor === undefined ? board.coordinates() : board.candidatePlacementOffsets(anchor);
      for (const at of offsets) {
        const move = new PlacePiece(position, at);
        if (state.canPlace(move)) yield move;
      }
    }
  }

  // Puts the piece on the board and takes it from the tray.
  // When the tray is empty, the next pieces of the source fill it.
  protected apply(state: LinesState<TCoord>, move: PlacePiece<TCoord>): LinesState<TCoord> {
    state.placePiece(move);
    return state;
  }

  // D24 of `docs/REQUIREMENTS.md`. The team accepted the proposal on issue #58 on 2026-11-16.
  // The combo is the count of distinct full lines, on any axis of the topology, after one placement.
  // The rules find every full line first and then clear their union, so a shared cell clears once.
  // The streak counts the placements in a row that clear at least one line.
  // The first placement that clears no line sets it back to 0.
  protected resolve(state: LinesState<TCoord>): Resolution {
    state.clearLines(fullLines(state.snapshot().boardCopy()));
    return Resolution.resolved();
  }

  // The game ends when no tray piece fits (statement §1.1).
  protected evaluate(state: LinesState<TCoord>): Outcome {
    return this.noValidMove(state) ? Outcome.gameOver : Outcome.playing;
  }
}

// Every distinct full line on every axis of the topology.
// `GridTopology.line()` gives the cells of a line in order. It does not say at which end the walk starts.
// So the set of the cell keys names one line (gap G107.6, issue #134).
// The same line from either end gives the same name and counts once.
// A line of one cell can lie on several axes. It is one cell, so it counts once (issue #140).
// Each line keeps the cell order of the first walk that found it.
function fullLines<TCoord>(board: ReadonlyBoard<Color, TCoord>): TCoord[][] {
  const seen: CoordKey[][] = [];
  const full: TCoord[][] = [];
  const coordinates = board.coordinates();
  for (const axis of board.axes()) {
    for (const through of coordinates) {
      const line = [...board.line(axis, through)];
      const keys = lineKeys(board, line);
      if (seen.some((other) => CoordKey.sameKeys(other, keys))) continue;
      seen.push(keys);
      if (line.every((c) => board.occupantAt(c) !== undefined)) full.push(line);
    }
  }
  return full;
}

// The name of one line: the topology keys of its cells, without the axis (issue #140).
// A line of two or more cells lies on one axis, so the axis adds nothing to its name.
// `CoordKey.sameKeys()` compares two names in any order, so the walk direction does not count.
// A key is a value object, so no text of a key names the line (issue #246).
function lineKeys<TCoord>(
  board: ReadonlyBoard<Color, TCoord>,
  line: readonly TCoord[],
): CoordKey[] {
  return line.map((c) => board.key(c));
}
