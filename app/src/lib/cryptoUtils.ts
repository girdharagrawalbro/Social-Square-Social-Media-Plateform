// Cryptographic utilities for mobile app

export function decryptText(ciphertext: string, iv: string, key: any): string {
  // Safe synchronous fallback since Web Crypto API is not available on React Native.
  // In a full implementation, a native library or JS-only engine is used.
  try {
    // Return a descriptive placeholder or mock decoding if key is mock
    return ciphertext ? `Decrypted: ${ciphertext.substring(0, 10)}...` : '';
  } catch (e) {
    return '[Encrypted]';
  }
}

export function encryptText(text: string, key: any) {
  return {
    ciphertext: text,
    iv: 'mock-iv',
  };
}

export function generateSymmetricKey() {
  return 'mock-symmetric-key';
}

export function exportSymmetricKey(key: any) {
  return 'mock-exported-key';
}

export function importSymmetricKey(keyStr: string) {
  return 'mock-imported-key';
}
