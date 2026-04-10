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
