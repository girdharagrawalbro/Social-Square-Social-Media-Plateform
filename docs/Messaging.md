# Messaging (Offline Chat)

## Offline Chat

### Problem
Messages should not be lost when the user loses internet connection, and the UI should gracefully handle offline states.

### Implementation

1. **Browser**: User sends a message.
2. **IndexedDB Queue**: If offline, the message and encrypted media blob are saved to a local IndexedDB queue.
3. **Network Restored**: Browser regains connectivity (`online` event).
4. **Background Sync**: The queue processes pending messages.
5. **API / Socket**: Messages are sent to the backend.
6. **Socket Confirmation**: Server acknowledges receipt (double-checkmark).

### Failure Handling
- **Send Failure**: Retry with exponential backoff.
- **App Reload while Offline**: Unsent messages persist in IndexedDB and retry upon next load.

### Benefits
- No message loss.
- Seamless user experience even in poor network conditions.
