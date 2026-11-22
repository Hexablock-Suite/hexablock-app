import * as ReactNative from 'react-native';
import { Platform } from 'react-native';
import { Platform as Device } from 'react-native-web';

// Each read of the platform below is a wrong example for the platform gate.
export const isWeb = Platform.OS === 'web';
export const gutter = Platform.select({ web: 24, default: 16 });
const { OS } = Device;
export const name = OS;
export const version = ReactNative.Platform.Version;
export const expoOs = process.env.EXPO_OS;
export const required = require('react-native').Platform.OS;
