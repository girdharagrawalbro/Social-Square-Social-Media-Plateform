/**
 * Crypto utilities for React Native.
 * Uses @noble/ciphers for AES-GCM decryption (pure JS, no native modules).
 */
import { gcm } from '@noble/ciphers/aes';

/**
 * Convert a base64 string to a Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  // React Native's global atob works in Hermes
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to a base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decrypt an AES-GCM encrypted ArrayBuffer.
 * Matches the web's decryptFile(arrayBuffer, ivBase64, cryptoKey) function.
 *
 * @param encryptedBytes   The full encrypted file bytes (Uint8Array)
 * @param base64Key        Base64-encoded 256-bit AES key (the videoKey / fileKey field)
 * @param base64Iv         Base64-encoded 12-byte IV (the videoIv field)
 * @returns                Decrypted bytes as Uint8Array
 */
export async function decryptAesGcm(
  encryptedBytes: Uint8Array,
  base64Key: string,
  base64Iv: string,
): Promise<Uint8Array> {
  const key = base64ToBytes(base64Key);
  const iv = base64ToBytes(base64Iv);
  const cipher = gcm(key, iv);
  return cipher.decrypt(encryptedBytes);
}

export async function decryptText(
  ciphertextBase64: string,
  ivBase64: string,
  keyString: string,
): Promise<string> {
  try {
    const ciphertext = base64ToBytes(ciphertextBase64);
    const iv = base64ToBytes(ivBase64);
    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < Math.min(keyString.length, 32); i++) {
      keyBytes[i] = keyString.charCodeAt(i);
    }
    const cipher = gcm(keyBytes, iv);
    const decrypted = cipher.decrypt(ciphertext);
    
    let decryptedStr = '';
    for (let i = 0; i < decrypted.length; i++) {
      decryptedStr += String.fromCharCode(decrypted[i]);
    }
    return decryptedStr;
  } catch (err) {
    console.warn('Decryption failed:', err);
    return '🔑 Encrypted';
  }
}

export async function encryptText(
  text: string,
  keyString: string,
): Promise<{ ciphertext: string; iv: string }> {
  const cleartext = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    cleartext[i] = text.charCodeAt(i);
  }
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    iv[i] = Math.floor(Math.random() * 256);
  }
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < Math.min(keyString.length, 32); i++) {
    keyBytes[i] = keyString.charCodeAt(i);
  }
  const cipher = gcm(keyBytes, iv);
  const ciphertext = cipher.encrypt(cleartext);
  return {
    ciphertext: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
  };
}
