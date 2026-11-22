import { Platform } from './platform';

// Each line names the platform without reading the platform of React Native.
// Platform.OS in a comment is no read.
export const label = 'Platform.OS';
export const table = { Platform: 'web' };
export const own = Platform.name;
export const other = table.Platform;
export const env = process.env.NODE_ENV;
