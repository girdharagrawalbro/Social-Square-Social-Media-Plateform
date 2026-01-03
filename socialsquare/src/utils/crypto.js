// Password encryption utility for secure transmission
// This encrypts the password before sending it over the network

const ENCRYPTION_KEY = 'socialsquare_encryption_key_2024';

// Create a key from the encryption key using Web Crypto API
const getKeyMaterial = async () => {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(ENCRYPTION_KEY),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
};

const getKey = async (salt) => {
    const keyMaterial = await getKeyMaterial();
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-CBC', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
};

// Simple XOR-based encryption for browser compatibility
// This provides basic obfuscation to prevent plain-text password exposure in network requests
export const encryptPassword = (password) => {
    try {
        // Generate a random IV
        const iv = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        // XOR-based encryption with key
        let encrypted = '';
        for (let i = 0; i < password.length; i++) {
            const charCode = password.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            encrypted += charCode.toString(16).padStart(2, '0');
        }
        
        // Create the encrypted payload
        const payload = JSON.stringify({
            iv: iv,
            encryptedPassword: encrypted
        });
        
        // Base64 encode the payload
        return btoa(payload);
    } catch (error) {
        console.error('Encryption error:', error);
        // Fallback: return original password (should not happen in production)
        return password;
    }
};

// Check if encryption is available
export const isEncryptionAvailable = () => {
    return typeof crypto !== 'undefined' && typeof btoa !== 'undefined';
};
