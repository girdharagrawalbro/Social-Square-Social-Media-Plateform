# API Documentation

## Standardized API Reference

All API responses follow the format: 
`{ "success": true, "data": { ... } }` or `{ "success": false, "message": "..." }`.

### Authentication (`/api/auth`)

- `POST /api/auth/login`: Authenticates user and returns JWT. Requires credentials and fingerprint.
- `POST /api/auth/register`: Creates a new user.
- `POST /api/auth/search`: Searches for users by query.

### Posts (`/api/post`)

- `POST /api/post/create`: Creates a new post. Expects encrypted media URLs and metadata.
- `GET /api/post/feed`: Fetches the feed with cursor-based pagination.
  - Query Params: `limit`, `cursor`.

### Messaging (`/api/messages`)

- `POST /api/messages/send`: Sends a message to a conversation.
- `GET /api/messages/:conversationId`: Retrieves messages with cursor pagination.

*(For detailed payloads and examples, please refer to Postman collections or the legacy README).*
