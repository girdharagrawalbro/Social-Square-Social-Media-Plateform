# Content Security

## End-to-End Encryption (E2EE)

### Problem
Protecting user content (messages, media) from unauthorized access by intermediate servers or malicious actors.

### Implementation
- **Text Messages**: All standard text messages in direct chats are fully end-to-end encrypted before they leave the browser, ensuring zero-knowledge privacy for conversations.
- **Encrypted Feed Posts**: Uploaded feed content (images, videos, voice notes) can be encrypted client-side using symmetric AES-GCM keys before hitting the Cloudinary CDN.
- **Chat Media Encryption**: Direct messages containing images, voice notes, and documents are encrypted in-transit. Custom Web Crypto API functions handle chunked binary files seamlessly.
- **Key Exchange**: Symmetric media keys are encrypted via RSA-OAEP using the recipient's public key.

### Failure Handling
- If a decryption key is lost or corrupted, content cannot be restored (by design, to ensure true zero-knowledge privacy).
- Client handles decryption errors gracefully with fallback UI placeholders.

### Benefits
- Zero-knowledge privacy for all private communications and protected media.
- Compliance with strict data protection requirements.
