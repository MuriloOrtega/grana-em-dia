// Armazenamento da sessão no Keychain (iOS) / Keystore (Android) via expo-secure-store.
// O SecureStore recomenda valores pequenos; o JWT da sessão é dividido em pedaços.
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1500;
const MAX_CHUNKS = 50;

async function readCount(key: string): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(`${key}.n`);
  if (raw === null) return null;
  const count = Number(raw);
  return Number.isInteger(count) && count >= 1 && count <= MAX_CHUNKS ? count : null;
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readCount(key);
    if (count === null) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    }
    // O contador é gravado por último: uma gravação interrompida nunca é lida como válida.
    await SecureStore.setItemAsync(`${key}.n`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const count = await readCount(key);
    await SecureStore.deleteItemAsync(`${key}.n`);
    if (count === null) return;
    for (let i = 0; i < count; i += 1) await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
};
