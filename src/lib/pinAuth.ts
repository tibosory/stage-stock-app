import * as Crypto from 'expo-crypto';

const SALT = 'stagestock.pin.v1';

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${SALT}:${pin}`
  );
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const h = await hashPin(pin);
  return h === storedHash;
}

/** PIN usine (première connexion) — doit être changé avant usage normal. */
export const FACTORY_DEFAULT_PIN = '1234';

export function isFactoryDefaultPin(pin: string): boolean {
  return pin.trim() === FACTORY_DEFAULT_PIN;
}

export async function storedPinIsFactoryDefault(storedHash: string): Promise<boolean> {
  const factoryHash = await hashPin(FACTORY_DEFAULT_PIN);
  return storedHash === factoryHash;
}
