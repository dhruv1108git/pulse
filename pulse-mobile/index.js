/**
 * @format
 */

import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// TextEncoder/TextDecoder polyfills for React Native
import { TextEncoder, TextDecoder } from 'text-encoding';
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
