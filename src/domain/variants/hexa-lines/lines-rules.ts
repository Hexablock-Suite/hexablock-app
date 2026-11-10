import type { Board } from '../../engine/board';
import type { Color } from '../../engine/color';
import type { Outcome } from '../../engine/outcome';
import { Resolution } from '../../engine/resolution';
import { BaseGameRules } from '../../engine/rules';
import type { LinesState } from './lines-state';
import { PlacePiece } from './place-piece';

// The rules of Hexa Lines (statement §1.1). The rules ask the topology for the axes,
// so they never hard-code 3 axes or 6 directions (D4).
// Hexa Lines has no gravity (REQUIREMENTS.md §8). A cleared cell stays empty, and no cell moves.
// The rules decide. The state changes itself: the rules call `placePiece()` and `clearLines()`.
export class LinesRules<TCoord> extends BaseGameRules<PlacePiece<TCoord>, LinesState<TCoord>> {
  isValid(state: LinesState<TCoord>, move: PlacePiece<TCoord>): boolean {
    if (!Number.isInteger(move.trayIndex)) return false;
    return state.canPlace(move);
  }

  // A lazy generator: each tray piece at each offset that a board cell gives.
  // The «no tray piece fits» end reads only its first move (classes.md decision 33).
  *validMoves(state: LinesState<TCoord>): Iterable<PlacePiece<TCoord>> {
    for (const trayIndex of state.tray.keys()) {
      for (const at of state.board.shape.cells) {
        const move = new PlacePiece(trayIndex, at);
        if (state.canPlace(move)) yield move;
      }
    }
  }

  // Puts the piece on the board and takes it from the tray.
  // When the tray is empty, the next pieces of the source fill it.
  apply(state: LinesState<TCoord>, move: PlacePiece<TCoord>): LinesState<TCoord> {
    state.placePiece(move);
    return state;
  }

  // Proposal on issue 58, «Propuesta, pendiente del equipo (cola nocturna, 2026-11-06)».
  // The combo is the count of distinct full lines, on any axis of the topology, after one placement.
  // The rules find every full line first and then clear their union, so a shared cell clears once.
  // The streak counts the placements in a row that clear at least one line.
  // The first placement that clears no line sets it back to 0.
  resolve(state: LinesState<TCoord>): Resolution<LinesState<TCoord>> {
    state.clearLines(fullLines(state.board));
    return Resolution.resolved(state);
  }

  // The game ends when no tray piece fits (statement §1.1).
  evaluate(state: LinesState<TCoord>): Outcome {
    return this.noValidMove(state) ? 'game-over' : 'playing';
  }
}

// Every distinct full line on every axis of the topology.
// `GridTopology.line()` gives the cells of a line in order. It does not say at which end the walk starts.
// So the set of the cell keys names one line (gap G107.6, issue #134).
// The same line from either end gives the same name and counts once.
// A line of one cell can lie on several axes. It is one cell, so it counts once (issue #140).
// Each line keeps the cell order of the first walk that found it.
function fullLines<TCoord>(board: Board<Color, TCoord, string>): TCoord[][] {
  const seen = new Set<string>();
  const full: TCoord[][] = [];
  for (const axis of board.topology.axes()) {
    for (const through of board.shape.cells) {
      const line = [...board.line(axis, through)];
      const id = lineId(board, line);
      if (seen.has(id)) continue;
      seen.add(id);
      if (line.every((c) => board.get(c) !== undefined)) full.push(line);
    }
  }
  return full;
}

// The name of one line: the sorted topology keys of its cells, without the axis (issue #140).
// A line of two or more cells lies on one axis, so the axis adds nothing to its name.
// JSON keeps the keys apart, so no key text can join two keys into one.
function lineId<TCoord>(board: Board<Color, TCoord, string>, line: readonly TCoord[]): string {
  const keys = line.map((c) => board.topology.key(c)).sort();
  return JSON.stringify(keys);
}
