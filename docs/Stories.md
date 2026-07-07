# Stories

## Ephemeral Content (Stories)

### Problem
Managing short-lived content (24 hours) efficiently and handling media transformations for rapid viewing.

### Implementation
- **Lifecycle**: Stories are timestamped upon creation. A TTL (Time-To-Live) index in MongoDB automatically deletes the document after 24 hours.
- **Drafts**: Background story composing, text positioning, and sticker locations are auto-saved to IndexedDB.
- **Media**: Video stories are transcoded by BullMQ workers into HLS streams for adaptive bitrate playback.

### Failure Handling
- **Upload Interruption**: Local object URLs are restored from IndexedDB, allowing users to retry uploads without losing their edits.

### Benefits
- Highly optimized viewing experience.
- Automated cleanup reduces storage costs.
