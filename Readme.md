# DriveStore — Google Drive Upload Microservice

A standalone Express microservice that uploads **images, videos, PDFs, and any file type** to Google Drive through a single API call — drop-in compatible with the `clodinary/` service in this repo.

> **Port:** `5002`  
> **API Base:** `/api/drive`

---

## Quick Start

### 1. Install Dependencies

```bash
cd gdrive
npm install
```

### 2. Set Up Google Credentials

#### a) Create a Google Cloud Project
1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "DriveStore")
3. Enable the **Google Drive API**:  
   _APIs & Services → Enable APIs & Services → Search "Google Drive API" → Enable_

#### b) Create a Service Account
1. _APIs & Services → Credentials → Create Credentials → Service Account_
2. Give it any name (e.g. `drivestore-bot`) → Click Done
3. Click your new service account → **Keys** tab → **Add Key** → **Create new key** → **JSON**
4. Download the JSON key and save it as `gdrive/service-account.json`

#### c) Share a Drive Folder with the Service Account
1. Open [Google Drive](https://drive.google.com) → Create a folder (e.g. `DriveStore`)
2. Right-click the folder → **Share**
3. Paste the service account email (looks like `drivestore-bot@my-project.iam.gserviceaccount.com`)
4. Give it **Editor** access → Share
5. Copy the folder ID from the URL:  
   `https://drive.google.com/drive/folders/`**`1ABC_this_is_your_folder_id`**

#### d) Create `.env`

```bash
cp .env.example .env
```

Fill in:
```env
PORT=5002
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account.json
GOOGLE_DRIVE_ROOT_FOLDER_ID=1ABC_your_folder_id_here
CORS_ORIGINS=*
GDRIVE_SERVICE_URL=http://localhost:5002
```

### 3. Run the Server

```bash
npm run dev   # development (nodemon)
npm start     # production
```

---

## API Reference

All responses use the same envelope as the Cloudinary service:

```json
{ "success": true,  "data": { ... } }
{ "success": false, "message": "error description" }
```

---

### `POST /api/drive/upload`

Universal upload — handles multipart **and** base64 JSON in one endpoint.

#### Option A — multipart/form-data (images, videos, any file)

```bash
curl -X POST http://localhost:5002/api/drive/upload \
  -F "file=@/path/to/photo.jpg" \
  -F "folder=posts"
```

#### Option B — JSON base64 (same interface as Cloudinary service)

```bash
curl -X POST http://localhost:5002/api/drive/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file": "data:image/png;base64,iVBORw0KGgo...",
    "folder": "ai-generated",
    "name": "my-image.png"
  }'
```

#### Response

```json
{
  "success": true,
  "data": {
    "fileId": "1ABC_xyz...",
    "name": "photo.jpg",
    "mimeType": "image/jpeg",
    "size": 204800,
    "webViewLink": "https://drive.google.com/file/d/1ABC.../view",
    "webContentLink": "https://drive.google.com/uc?id=1ABC...",
    "thumbnailLink": "https://lh3.googleusercontent.com/...",
    "createdTime": "2026-04-25T05:00:00.000Z"
  }
}
```

> **`webContentLink`** is the public CDN-style URL — use this anywhere you'd use a Cloudinary `secure_url`.

---

### `POST /api/drive/upload-url`

Downloads a remote file from a public URL and uploads it to Drive.

```bash
curl -X POST http://localhost:5002/api/drive/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/image.jpg",
    "folder": "remote-imports"
  }'
```

| Body param | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| `url`      | string | ✅       | Public URL of the file to upload   |
| `folder`   | string | ❌       | Sub-folder name in Drive           |
| `name`     | string | ❌       | Override stored filename           |

---

### `DELETE /api/drive/delete`

Permanently deletes a file from Google Drive.

```bash
curl -X DELETE http://localhost:5002/api/drive/delete \
  -H "Content-Type: application/json" \
  -d '{ "fileId": "1ABC_xyz..." }'
```

#### Response

```json
{ "success": true, "data": { "fileId": "1ABC_xyz...", "deleted": true } }
```

---

### `GET /api/drive/file/:fileId`

Fetches metadata for a single file.

```bash
curl http://localhost:5002/api/drive/file/1ABC_xyz...
```

---

### `GET /api/drive/list`

Lists files inside a Drive folder.

```bash
# List root folder (from env)
curl http://localhost:5002/api/drive/list

# Custom folder with pagination
curl "http://localhost:5002/api/drive/list?folderId=1XYZ&pageSize=50&pageToken=abc123"
```

| Query param  | Type   | Default | Description                               |
|--------------|--------|---------|-------------------------------------------|
| `folderId`   | string | env var | Drive folder ID                           |
| `pageSize`   | number | `20`    | Max files to return (max 100)             |
| `pageToken`  | string | —       | Token from previous response for next page |

---

### `GET /ping`

Health check.

```bash
curl http://localhost:5002/ping
# → { "status": "ok", "message": "pong", "service": "DriveStore..." }
```

---

## Integrating with the Main Backend

Use it exactly like the Cloudinary service. In `ai.js` or any route:

```js
const axios = require('axios');

const DRIVE_API_BASE = process.env.GDRIVE_API_BASE_URL || 'http://localhost:5002';

// Upload a buffer (e.g. AI-generated image)
async function uploadToDrive(imageBuffer, folder = 'ai-generated') {
    const res = await axios.post(`${DRIVE_API_BASE}/api/drive/upload`, {
        file: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        folder,
    });
    return res.data.data.webContentLink; // ← public CDN URL
}

// Upload from a URL
async function uploadUrlToDrive(url, folder = 'uploads') {
    const res = await axios.post(`${DRIVE_API_BASE}/api/drive/upload-url`, { url, folder });
    return res.data.data.webContentLink;
}

// Delete a file
async function deleteFromDrive(fileId) {
    await axios.delete(`${DRIVE_API_BASE}/api/drive/delete`, { data: { fileId } });
}
```

---

## Supported File Types

Any file type is accepted. Common examples:

| Category  | Examples                          |
|-----------|-----------------------------------|
| Images    | JPG, PNG, GIF, WEBP, SVG, HEIC   |
| Videos    | MP4, MOV, AVI, MKV, WEBM         |
| Documents | PDF, DOCX, XLSX, PPTX, TXT, CSV  |
| Archives  | ZIP, RAR, 7Z, TAR                 |
| Audio     | MP3, WAV, FLAC, AAC, OGG         |
| Other     | Any binary or text file           |

**Max file size:** 100 MB per upload.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `5002` | Server port |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | ✅ | `./service-account.json` | Path to SA JSON key |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ✅ | — | Shared Drive folder ID |
| `CORS_ORIGINS` | ❌ | `*` | Comma-separated allowed origins |
| `GDRIVE_SERVICE_URL` | ❌ | `http://localhost:5002` | Public URL (for self-ping keep-alive) |

---

## Deployment (Render / Railway / Fly.io)

1. Deploy as a separate web service pointing to the `gdrive/` directory
2. Set all env vars in the hosting dashboard
3. Set `GDRIVE_SERVICE_URL` to your public deployment URL
4. In the main backend, set `GDRIVE_API_BASE_URL` to the same URL
