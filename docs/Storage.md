# Storage System

## Media Storage Architecture

### Problem
Providing fast, reliable, and secure media delivery while protecting against single points of failure.

### Implementation

1. **Primary Storage (Cloudinary)**:
   - All encrypted media is primarily uploaded to Cloudinary for CDN delivery.
   - Cloudinary handles image transformations (resizing, WebP conversion).

2. **Secure Google Drive Fallback**:
   - Generic file attachments (PDF, ZIP) are routed to a dedicated Google Drive microservice.
   - If Cloudinary is unavailable (API timeout/error), the backend automatically intercepts the failure and uploads media to Google Drive.
   - Zero Google Drive credentials are ever exposed to the frontend.

3. **Database (MongoDB)**:
   - Stores metadata, URLs, and encryption initialization vectors (IVs).

### Failure Handling
- **CDN Outage**: Transparent fallback to Drive.

### Benefits
- High availability.
- Cost-effective storage tiering.
