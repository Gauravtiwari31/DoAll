/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { startCrashReporting } from './src/services/crashReporting';

startCrashReporting();

AppRegistry.registerComponent(appName, () => App);
