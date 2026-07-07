# Database & Data Stores

## Technologies Used

### MongoDB
- **Purpose**: Primary system of record. Stores Users, Posts, Messages, Stories, and Notifications.
- **Pattern**: Replica set for high availability and read scalability.

### Redis
- **Purpose**: 
  - **Presence**: Tracks online users in real-time.
  - **Session Cache**: Validates JWTs and fingerprints instantly without DB hit.
  - **Socket Mapping**: Redis Adapter for cross-instance Socket.io communication.
  - **Rate Limiting**: Throttles API requests via `express-rate-limit`.

### IndexedDB
- **Purpose**: Client-side storage.
- **Usage**: Offline messaging queues, feed caching, draft persistence, and recent search history.

### Design Patterns
- **Repository Pattern**: Abstracts database queries from business logic.
- **Data Loaders**: Prevents N+1 query problems in complex aggregations (like fetching user details for a list of comments).
