/**
 * Cryptographic utility functions for End-to-End Encryption (E2EE) using Web Crypto API.
 */

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper: Convert String to ArrayBuffer
function stringToArrayBuffer(str) {
  return new TextEncoder().encode(str);
}

// Helper: Convert ArrayBuffer to String
function arrayBufferToString(buffer) {
  return new TextDecoder().decode(buffer);
}

/**
 * Generates an RSA-OAEP key pair for asymmetric encryption and decryption.
 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey}>}
 */
export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a CryptoKey to JWK format.
 * @param {CryptoKey} key 
 * @returns {Promise<object>} JWK object
 */
export async function exportKeyToJWK(key) {
  return await window.crypto.subtle.exportKey("jwk", key);
}

/**
 * Imports a public or private key from JWK format.
 * @param {object} jwk 
 * @param {'public'|'private'} type 
 * @returns {Promise<CryptoKey>}
 */
export async function importKeyFromJWK(jwk, type) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    type === "public" ? ["encrypt"] : ["decrypt"]
  );
}

/**
 * Derives a strong AES-GCM key from a user's password using PBKDF2.
 * @param {string} password 
 * @param {Uint8Array} salt 
 * @returns {Promise<CryptoKey>} Derived key
 */
export async function deriveKeyFromPassword(password, salt) {
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    stringToArrayBuffer(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a private key using a password-derived key for secure backup.
 * @param {CryptoKey} privateKey 
 * @param {string} password 
 * @returns {Promise<{ciphertext: string, iv: string, salt: string}>}
 */
export async function encryptPrivateKey(privateKey, password) {
  const jwk = await exportKeyToJWK(privateKey);
  const jwkString = JSON.stringify(jwk);
  const jwkBuffer = stringToArrayBuffer(jwkString);

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const derivedKey = await deriveKeyFromPassword(password, salt);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    derivedKey,
    jwkBuffer
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt)
  };
}

/**
 * Decrypts a backed-up private key using the password.
 * @param {string} ciphertextBase64 
 * @param {string} ivBase64 
 * @param {string} saltBase64 
 * @param {string} password 
 * @returns {Promise<CryptoKey>} Decrypted private key
 */
export async function decryptPrivateKey(ciphertextBase64, ivBase64, saltBase64, password) {
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));

  const derivedKey = await deriveKeyFromPassword(password, salt);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    derivedKey,
    ciphertext
  );

  const jwkString = arrayBufferToString(decryptedBuffer);
  const jwk = JSON.parse(jwkString);

  return await importKeyFromJWK(jwk, "private");
}

/**
 * Generates a random 256-bit AES-GCM key for symmetric message encryption.
 * @returns {Promise<CryptoKey>}
 */
export async function generateSymmetricKey() {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a symmetric AES key to a Base64 string.
 * @param {CryptoKey} key 
 * @returns {Promise<string>} Base64 representation
 */
export async function exportSymmetricKey(key) {
  const raw = await window.crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(raw);
}

/**
 * Imports a symmetric AES key from a Base64 string.
 * @param {string} base64Key 
 * @returns {Promise<CryptoKey>}
 */
export async function importSymmetricKey(base64Key) {
  const raw = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts cleartext using an AES-GCM key.
 * @param {string} text 
 * @param {CryptoKey} key 
 * @returns {Promise<{ciphertext: string, iv: string}>}
 */
export async function encryptText(text, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const textBuffer = stringToArrayBuffer(text);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    textBuffer
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv)
  };
}

/**
 * Decrypts ciphertext using an AES-GCM key.
 * @param {string} ciphertextBase64 
 * @param {string} ivBase64 
 * @param {CryptoKey} key 
 * @returns {Promise<string>} Cleartext
 */
export async function decryptText(ciphertextBase64, ivBase64, key) {
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );

  return arrayBufferToString(decryptedBuffer);
}

/**
 * Encrypts a raw File (or Blob) bytes using an AES-GCM key.
 * @param {Blob|File} file 
 * @param {CryptoKey} key 
 * @returns {Promise<{ciphertext: ArrayBuffer, iv: string}>}
 */
export async function encryptFile(file, key) {
  const arrayBuffer = await file.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    arrayBuffer
  );

  return {
    ciphertext,
    iv: arrayBufferToBase64(iv)
  };
}

/**
 * Decrypts file bytes using an AES-GCM key.
 * @param {ArrayBuffer} ciphertext 
 * @param {string} ivBase64 
 * @param {CryptoKey} key 
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptFile(ciphertext, ivBase64, key) {
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

  return await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );
}

/**
 * Encrypts a symmetric AES key (raw exported bytes) using a recipient's RSA-OAEP public key.
 * @param {string} base64AesKey 
 * @param {CryptoKey} rsaPublicKey 
 * @returns {Promise<string>} Base64 encrypted key
 */
export async function encryptSymmetricKeyWithRSA(base64AesKey, rsaPublicKey) {
  const aesKeyBuffer = stringToArrayBuffer(base64AesKey);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    aesKeyBuffer
  );
  return arrayBufferToBase64(encryptedBuffer);
}

/**
 * Decrypts a symmetric AES key using a recipient's RSA-OAEP private key.
 * @param {string} encryptedBase64 
 * @param {CryptoKey} rsaPrivateKey 
 * @returns {Promise<string>} Base64 symmetric key
 */
export async function decryptSymmetricKeyWithRSA(encryptedBase64, rsaPrivateKey) {
  const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivateKey,
    encryptedBuffer
  );
  return arrayBufferToString(decryptedBuffer);
}
