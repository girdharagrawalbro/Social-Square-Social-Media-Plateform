const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'socialsquare_encryption_key_2024';

// Decrypt password received from frontend (XOR-based decryption)
const decryptPassword = (encryptedData) => {
    try {
        const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
        const { iv, encryptedPassword } = JSON.parse(decoded);
        
        // XOR-based decryption with key
        let decrypted = '';
        const hexPairs = encryptedPassword.match(/.{2}/g) || [];
        
        for (let i = 0; i < hexPairs.length; i++) {
            const charCode = parseInt(hexPairs[i], 16) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            decrypted += String.fromCharCode(charCode);
        }
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        // If decryption fails, return the original (for backward compatibility)
        return encryptedData;
    }
};

// Check if password is encrypted (base64 JSON format)
const isEncrypted = (password) => {
    try {
        const decoded = Buffer.from(password, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        return parsed.iv && parsed.encryptedPassword;
    } catch {
        return false;
    }
};

module.exports = { decryptPassword, isEncrypted };
