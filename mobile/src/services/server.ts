import { useSyncExternalStore } from 'react';
import { DEFAULT_API_URL } from '../config';
import { STORAGE_KEYS, storage } from './storage';

/**
 * The API address the app talks to. Defaults to the emulator address and can
 * be changed from the welcome screen, so a single APK works on an emulator,
 * a phone on the same Wi-Fi as the API, or against a deployed server.
 */
let current = DEFAULT_API_URL;
const listeners = new Set<() => void>();

function set(url: string) {
  current = url;
  listeners.forEach(listener => listener());
}

/**
 * Turns what a person types into a usable base URL:
 *   "192.168.1.20:3000"          → "http://192.168.1.20:3000/api"
 *   "https://doall.example.com/" → "https://doall.example.com/api"
 * Returns null when there is no host to talk to.
 */
export function normalizeApiUrl(input: string): string | null {
  const match = input
    .trim()
    .match(
      /^(https?:\/\/)?([a-z0-9.-]+|\[[0-9a-f:]+\])(:\d{1,5})?(\/[^\s?#]*)?$/i,
    );
  if (!match) {
    return null;
  }
  const [, scheme = 'http://', host, port = '', rawPath = ''] = match;
  const path = rawPath.replace(/\/+$/, '') || '/api';
  return `${scheme.toLowerCase()}${host}${port}${path}`;
}

/** "http://192.168.1.20:3000/api" → "192.168.1.20:3000" (for compact display). */
export const displayHost = (url: string) =>
  url.replace(/^https?:\/\//, '').replace(/\/api$/, '');

export const server = {
  getUrl: (): string => current,

  isDefault: (): boolean => current === DEFAULT_API_URL,

  async restore(): Promise<string> {
    const saved = await storage.get<string>(STORAGE_KEYS.apiUrl);
    set((saved && normalizeApiUrl(saved)) || DEFAULT_API_URL);
    return current;
  },

  async save(url: string): Promise<void> {
    set(url);
    if (url === DEFAULT_API_URL) {
      await storage.remove(STORAGE_KEYS.apiUrl);
    } else {
      await storage.set(STORAGE_KEYS.apiUrl, url);
    }
  },
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Current API address; re-renders when it changes. */
export const useServerUrl = () =>
  useSyncExternalStore(subscribe, server.getUrl);
