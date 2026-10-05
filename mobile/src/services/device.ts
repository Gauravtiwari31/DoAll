import NativeDevice from '../native/NativeDevice';
import { deviceTimeZone } from '../utils/timezone';

/** A version 4 UUID, without the native module (tests) from Math.random. */
function fallbackUUID(): string {
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
  hex[12] = '4'; // version 4
  hex[16] = '89ab'[Math.floor(Math.random() * 4)]; // RFC 4122 variant
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(
    16,
    20,
  )}-${s.slice(20)}`;
}

export const device = {
  /** A new ID for a task created on this phone. */
  newId: (): string => NativeDevice?.randomUUID() ?? fallbackUUID(),

  /** The phone's IANA time zone. */
  timeZone: (): string => NativeDevice?.getTimeZone() || deviceTimeZone(),

  /**
   * Asks where to save a text file and saves it there. Resolves false if the
   * person backed out; rejects if this phone can't save files.
   */
  async saveTextFile(
    fileName: string,
    mimeType: string,
    contents: string,
  ): Promise<boolean> {
    if (!NativeDevice) {
      throw new Error("Saving files isn't available on this device");
    }
    return NativeDevice.saveTextFile(fileName, mimeType, contents);
  },
};
