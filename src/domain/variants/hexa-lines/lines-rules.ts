import { Board } from '../../engine/board';
import type { Color } from '../../engine/color';
import type { CoordKey } from '../../engine/coord-key';
import type { Outcome } from '../../engine/outcome';
import type { Piece } from '../../engine/piece';
import { Resolution } from '../../engine/resolution';
import { BaseGameRules } from '../../engine/rules';
import { drawTray, LinesState } from './lines-state';
import { PlacePiece } from './place-piece';

// The rules of Hexa Lines (statement §1.1). The rules ask the topology for the axes,
// so they never hard-code 3 axes or 6 directions (D4).
// Hexa Lines has no gravity (REQUIREMENTS.md §8). A cleared cell stays empty, and no cell moves.
export class LinesRules<TCoord> extends BaseGameRules<PlacePiece<TCoord>, LinesState<TCoord>> {
  isValid(state: LinesState<TCoord>, move: PlacePiece<TCoord>): boolean {
    if (!Number.isInteger(move.trayIndex)) return false;
    const piece = state.tray[move.trayIndex];
    return piece !== undefined && fits(state.board, piece, move.at);
  }

  // A lazy generator: each tray piece at each offset that a board cell gives.
  // The «no tray piece fits» end reads only its first move (classes.md decision 33).
  *validMoves(state: LinesState<TCoord>): Iterable<PlacePiece<TCoord>> {
    for (const [trayIndex, piece] of state.tray.entries()) {
      for (const at of state.board.shape.cells) {
        if (fits(state.board, piece, at)) yield new PlacePiece(trayIndex, at);
      }
    }
  }

  // Puts the piece on the board and takes it from the tray.
  // When the tray is empty, the next pieces of the source fill it.
  apply(state: LinesState<TCoord>, move: PlacePiece<TCoord>): LinesState<TCoord> {
    const piece = state.tray[move.trayIndex]!;
    const cells = cellsOf(state.board, piece, move.at);
    for (const c of cells) state.board.set(c, piece.content);
    state.cellsPlaced = cells.length;
    state.tray = state.tray.filter((_, i) => i !== move.trayIndex);
    if (state.tray.length === 0) state.tray = drawTray(state.source);
    return state;
  }

  // Proposal on issue 58, «Propuesta, pendiente del equipo (cola nocturna, 2026-11-06)».
  // The combo is the count of distinct full lines, on any axis of the topology, after one placement.
  // The rules find every full line first and then clear their union, so a shared cell clears once.
  // The streak counts the placements in a row that clear at least one line.
  // The first placement that clears no line sets it back to 0.
  resolve(state: LinesState<TCoord>): Resolution<LinesState<TCoord>> {
    const lines = fullLines(state.board);
    const cleared = new Set(lines.flatMap((line) => line.map((c) => state.board.topology.key(c))));
    return Resolution.resolved(
      new LinesState(
        without(state.board, cleared),
        state.tray,
        state.source,
        lines.length > 0 ? state.streak + 1 : 0,
        lines.length,
        state.cellsPlaced,
        state.score,
      ),
    );
  }

  // The game ends when no tray piece fits (statement §1.1).
  evaluate(state: LinesState<TCoord>): Outcome {
    return this.noValidMove(state) ? 'game-over' : 'playing';
  }
}

function cellsOf<TCoord>(
  board: Board<Color, TCoord, string>,
  piece: Piece<Color, TCoord>,
  at: TCoord,
): TCoord[] {
  return piece.translated(at, board.topology).shape.cells();
}

// A piece fits when each of its cells lies inside the board on an empty cell.
function fits<TCoord>(
  board: Board<Color, TCoord, string>,
  piece: Piece<Color, TCoord>,
  at: TCoord,
): boolean {
  return cellsOf(board, piece, at).every((c) => board.contains(c) && board.get(c) === undefined);
}

// Every distinct full line on every axis of the topology.
// `GridTopology.line()` gives the cells of a line in order. It does not say at which end the walk starts.
// So the axis and the set of the cell keys name one line (gap G107.6, issue #134).
// The same line from either end gives the same name and counts once.
// Each line keeps the cell order of the first walk that found it.
function fullLines<TCoord>(board: Board<Color, TCoord, string>): TCoord[][] {
  const seen = new Set<string>();
  const full: TCoord[][] = [];
  for (const axis of board.topology.axes()) {
    for (const through of board.shape.cells) {
      const line = [...board.line(axis, through)];
      const id = lineId(board, axis, line);
      if (seen.has(id)) continue;
      seen.add(id);
      if (line.every((c) => board.get(c) !== undefined)) full.push(line);
    }
  }
  return full;
}

// The name of one line: its axis and the sorted topology keys of its cells.
// JSON keeps the parts apart, so no key text can join two parts into one.
function lineId<TCoord>(
  board: Board<Color, TCoord, string>,
  axis: string,
  line: readonly TCoord[],
): string {
  const keys = line.map((c) => board.topology.key(c)).sort();
  return JSON.stringify([axis, ...keys]);
}

// A copy of the board without the `cleared` cells. The engine board has no way to empty a cell,
// so the rules build a new board from the cells that stay.
function without<TCoord>(
  board: Board<Color, TCoord, string>,
  cleared: ReadonlySet<CoordKey>,
): Board<Color, TCoord, string> {
  if (cleared.size === 0) return board;
  const kept = new Map<CoordKey, [TCoord, Color]>();
  for (const [c, cell] of board.cells()) {
    const key = board.topology.key(c);
    if (!cleared.has(key)) kept.set(key, [c, cell]);
  }
  return new Board(board.shape, board.topology, kept);
}
