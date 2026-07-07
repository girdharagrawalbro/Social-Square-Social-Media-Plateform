# Notifications

## Notification System

### Problem
Delivering real-time alerts for various interactions (likes, mentions, follows) without overwhelming the client or database.

### Implementation
- **Event Dispatch**: When a user interaction occurs (e.g., Alice likes Bob's post), a background job is queued in BullMQ.
- **Processing**: The worker formats the notification and saves it to MongoDB.
- **Real-Time Push**: A `notification` event is emitted via Socket.io to the recipient's room (using Redis Adapter).
- **Client Cache**: TanStack Query periodically refetches notification counts, updating the UI badge instantly.

### Failure Handling
- If the user is offline, the notification remains in the database. Upon login, TanStack Query fetches the missed notifications.

### Benefits
- Decouples core actions from notification logic.
- Scalable push architecture.
