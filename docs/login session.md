# 🛡️ Social Square: Session & Security Flow

Social Square uses a multi-layered authentication system combining **JWTs**, **Browser Fingerprinting**, and **Persistent Session Tracking** to ensure that user accounts remain secure even if a token is intercepted.

---

## 1. 🔑 The Login Flow
When a user logs in, the backend performs several security checks before issuing tokens.

### A. Fingerprinting
- The frontend generates a unique **browser fingerprint** (based on hardware, browser version, etc.).
- This fingerprint is sent to the backend and stored as a **SHA-256 hash**.
- **Purpose:** This binds a login session to a specific device/browser. Even if a hacker steals a `refreshToken`, they cannot use it from a different browser because the fingerprint won't match.

### B. Session Handling (Same Device Logic)
- The backend checks the `LoginSession` collection for an existing session with the same `userId` and `fingerprint`.
- **New Device:** If no match is found, a new session is created, and a "New Device Alert" email is sent to the user.
- **Recognized Device:** If a match is found, the **existing session is updated** (tokens are refreshed, IP/Location is updated). This prevents your database from being flooded with multiple sessions for the same device.

### C. Limits
- Users are limited to **10 active sessions** at a time. This prevents session bloat and forces a cleanup of old devices.

---

## 2. 🔄 How "Revoke" Works
Revocation is the process of instantly killing a session so it can no longer be used.

### A. Individual Revocation
- When a user goes to **Settings > Active Sessions** and clicks "Logout" on a specific device, the backend sets `isRevoked: true` for that session ID.
- The user is sent a **Security Email** notifying them that a session was terminated.

### B. "Logout from All Devices"
- The backend searches for all sessions belonging to the user *except* the one they are currently using.
- It sets `isRevoked: true` for all of them.
- This is critical if a user suspects their account has been compromised.

---

## 3. 🛡️ Checks During Every Request
Every time the frontend tries to refresh its `accessToken` (via the `/refresh` endpoint), the following checks occur:

1.  **Token Validity:** Is the `refreshToken` cryptographically valid?
2.  **Revocation Check:** Has this session been marked as `isRevoked: true`?
3.  **Expiry Check:** Is the session past its 30-day sliding expiry?
4.  **Fingerprint Match:** Does the current browser's fingerprint match the hash stored when the session was first created?
5.  **Hard Ceiling:** Is the session older than **90 days**? (Even active sessions are forced to re-login after 90 days for safety).

---

## 4. 🚀 Why This is "Premium"
- **Transparency:** Users can see exactly which devices (e.g., "Chrome on Windows") and locations (e.g., "New York, US") are accessing their account.
- **Control:** Remote logout gives users total control over their data.
- **Audit Logs:** Every successful login and failed attempt is logged to an `AuditLog`, allowing for future security reviews.

---
