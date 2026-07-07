# Authentication

## Authentication Flow

### Problem
Securing user sessions across multiple devices while protecting against unauthorized access and tracking active logins.

### Implementation
The system uses a JWT-based authentication combined with session fingerprinting and Redis for active session management.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant AuthAPI
    participant Redis
    participant MongoDB
    
    User->>Frontend: Enter Credentials
    Frontend->>AuthAPI: POST /api/auth/login (credentials + fingerprint)
    AuthAPI->>MongoDB: Verify Credentials
    AuthAPI->>Redis: Store Session Hash (Fingerprint)
    AuthAPI-->>Frontend: JWT Token
    Frontend->>Frontend: Store in Memory & init session
```

### Failure Handling
- **Invalid Credentials**: Returns 401 Unauthorized with generic message.
- **Unrecognized Fingerprint/IP**: Triggers Email-based 2FA (OTP) before granting a token.
- **Token Expiry**: Handled via silent refresh endpoint.

### Benefits
- Prevents session hijacking.
- Remote "Logout from all devices" capability via Redis invalidation.
- High security without compromising user experience.
