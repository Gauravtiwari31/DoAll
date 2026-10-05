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
