import { Platform } from 'react-native';

// The design tokens of the screens (#169). They copy the tokens of the team prototype,
// https://prototipo-hexablock.vercel.app/: a scene of sky, hills and grass, wood signs
// and sun-yellow buttons with a lip below them.

export const palette = {
  sky: '#9AD0F0',
  cloud: '#F6F2EE',
  hill: '#5C7A93',
  grass: '#7DBA5A',
  grassShade: '#5E9A40',
  ink: '#2B2522',
  inkMuted: '#6A5D57',
  panel: '#F6F2EE',
  trim: '#DCD2E0',
  wood: '#A6786A',
  woodLight: '#C4917F',
  woodDark: '#7E5649',
  sun: '#FDC22E',
  sunDeep: '#DE9512',
  sunInk: '#5A3100',
  ribbon: '#DD5136',
  ribbonDeep: '#B03A24',
  white: '#FFFFFF',
  shade: 'rgba(0, 0, 0, 0.22)',
  // The board of the game screen: a dark wood face with sockets for the free spaces.
  socket: 'rgba(43, 37, 34, 0.42)',
  // The veil behind a prompt over the game screen (#177).
  scrim: 'rgba(43, 37, 34, 0.6)',
} as const;

// The two colors of one world on the map: the stone and its light inner face.
export interface WorldTone {
  readonly tone: string;
  readonly wash: string;
}

// The world colors of the prototype, in the order of the registry: orange, green, pink, blue.
// A fifth world takes the first color again.
const WORLD_TONES: readonly WorldTone[] = [
  { tone: '#F57A2A', wash: '#FFD9BC' },
  { tone: '#36B587', wash: '#C9EEDD' },
  { tone: '#E8708A', wash: '#F7C3C7' },
  { tone: '#4C9BE0', wash: '#CBE4F8' },
];

// The colors of the world at `position` in the registry, from 0.
export function worldTone(position: number): WorldTone {
  return WORLD_TONES[position % WORLD_TONES.length];
}

// The count of world colors. The home screen shows one stone for each color.
export const WORLD_TONE_COUNT = WORLD_TONES.length;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

// The height of the lip below a button, a sign or a stone. A pressed button sinks by its lip.
export const lip = { sm: 3, md: 6, lg: 9 } as const;

// The soft shadow of a sign and of a button.
export const shadow = {
  sign: '0 18px 28px rgba(0, 0, 0, 0.18)',
  soft: '0 8px 14px rgba(0, 0, 0, 0.14)',
} as const;

// The prototype draws its texts in Young Serif and Gelasio. The app bundles no font yet.
// So the screens take the serif face of the system, the fallback of the prototype.
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

// The face of a Merge tile and the color of its number (#177).
export interface TileTone {
  readonly face: string;
  readonly ink: string;
}

// The tones of the Merge tiles, one for each doubling from the tile of 2 up to the tile of 2048.
// They take the colors of the scene and of the four worlds, so the board stays in the world
// of the prototype. Each number has a contrast of 4.5:1 or more on its face.
// The tile of 2048, the target of the app, is a dark stone with a sun-yellow number.
const TILE_TONES: readonly TileTone[] = [
  { face: palette.cloud, ink: palette.ink },
  { face: worldTone(0).wash, ink: palette.ink },
  { face: worldTone(0).tone, ink: palette.ink },
  { face: worldTone(2).tone, ink: palette.ink },
  { face: palette.ribbonDeep, ink: palette.white },
  { face: palette.sunDeep, ink: palette.ink },
  { face: palette.sun, ink: palette.ink },
  { face: worldTone(1).tone, ink: palette.ink },
  { face: worldTone(3).tone, ink: palette.ink },
  { face: palette.hill, ink: palette.white },
  { face: palette.ink, ink: palette.sun },
];

// The tone of the Merge tile `step` doublings above the tile of 2. A larger tile keeps
// the tone of 2048, and a step below 0 takes the tone of 2.
export function tileTone(step: number): TileTone {
  return TILE_TONES[Math.max(0, Math.min(step, TILE_TONES.length - 1))];
}
