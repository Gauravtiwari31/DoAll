/* global jest */
// Native modules don't exist under Jest; swap in the official in-memory mocks.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
// The app's own Google sign-in Turbo Module (src/native) is Kotlin code;
// tests drive this stand-in instead.
jest.mock('./src/native/NativeGoogleSignIn', () => ({
  __esModule: true,
  default: {
    signIn: jest.fn(() => Promise.reject({ code: 'cancelled' })),
    signOut: jest.fn(() => Promise.resolve()),
  },
}));
// The app's other Turbo Modules (src/native).
jest.mock('./src/native/NativeDevice', () => ({
  __esModule: true,
  default: {
    randomUUID: () => require('crypto').randomUUID(),
    getTimeZone: () => 'Asia/Kolkata',
    saveTextFile: jest.fn(() => Promise.resolve(true)),
  },
}));
jest.mock('./src/native/NativeReminders', () => ({
  __esModule: true,
  default: {
    setReminders: jest.fn(() => Promise.resolve()),
    getStatus: jest.fn(() =>
      Promise.resolve({
        notificationsEnabled: true,
        exactAlarmsAllowed: true,
        ignoringBatteryOptimizations: false,
        scheduled: 0,
        nextAt: -1,
      }),
    ),
    openSettings: jest.fn(() => Promise.resolve(true)),
    takeOpenedTaskId: jest.fn(() => Promise.resolve(null)),
  },
}));
// SQLite on the phone; tests get a fresh in-memory database per test file,
// backed by Node's built-in SQLite (src/test-utils/sqlite.ts).
jest.mock('./src/db/database', () => {
  let db = null;
  return {
    getDatabase: () => {
      if (!db) {
        db = require('./src/test-utils/sqlite').createTestDatabase();
      }
      return db;
    },
  };
});
