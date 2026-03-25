### 📦 Cloudinary API Documentation
```md

Base URL: http://localhost:5000/api/cloudinary

```

#### 1. Upload Base64 Image

#### 📌 Endpoint
```


POST /upload-base64

```

#### 📥 Request Body

```
{
  "file": "data:image/png;base64,iVBORw0KGgoAAA...",
  "folder": "profile-images" // optional
}

```

#### 📤 Response

```
{
  "success": true,
  "data": {
    "public_id": "profile-images/abc123",
    "secure_url": "https://res.cloudinary.com/.../image/upload/abc123.png"
  }
}

```

#### ⚠️ Notes

* `file` must be a valid base64 string
* Max size depends on server config

---

#### 🌐 2. Upload Image from URL

#### 📌 Endpoint

```
POST /upload-url
```

#### 📥 Request Body

```json
{
  "url": "https://example.com/image.jpg",
  "folder": "ai-generated" // optional
}
```

#### 📤 Response

```json
{
  "success": true,
  "data": {
    "public_id": "ai-generated/xyz456",
    "secure_url": "https://res.cloudinary.com/.../image/upload/xyz456.jpg"
  }
}
```

---

#### ❌ 3. Delete Asset

#### 📌 Endpoint

```
DELETE /delete
```

### 📥 Request Body

```json
{
  "publicId": "uploads/abc123",
  "resourceType": "image" // optional (default: image)
}
```

### 📤 Response

```json
{
  "success": true,
  "data": {
    "result": "ok"
  }
}
```

#### 🔍 4. Get Asset Details

#### 📌 Endpoint

```
GET /:publicId
```

#### 📥 Example

```
GET /uploads/abc123
```

#### 📤 Response

```json
{
  "success": true,
  "data": {
    "public_id": "uploads/abc123",
    "format": "png",
    "width": 500,
    "height": 500,
    "created_at": "2026-03-25T10:00:00Z"
  }
}
```

---

#### 📂 5. List Assets

#### 📌 Endpoint

```
GET /
```

#### 📥 Query Params

```
?folder=uploads&max_results=10
```

#### 📤 Response

```json
{
  "success": true,
  "data": [
    {
      "public_id": "uploads/img1",
      "secure_url": "https://res.cloudinary.com/.../img1.jpg"
    },
    {
      "public_id": "uploads/img2",
      "secure_url": "https://res.cloudinary.com/.../img2.jpg"
    }
  ]
}
```

#### 🖼️ 6. Transform Image URL

#### 📌 Endpoint

```
GET /transform
```

#### 📥 Query Params

```
?publicId=uploads/abc123&width=300&height=300&crop=fill
```

#### 📤 Response

```json
{
  "success": true,
  "url": "https://res.cloudinary.com/.../image/upload/w_300,h_300,c_fill/abc123.jpg"
}
```

#### 🧠 Data You Should Store in DB

After upload, always store:

```json
{
  "publicId": "uploads/abc123",
  "url": "https://res.cloudinary.com/.../image/upload/abc123.jpg"
}
```

#### ⚡ Error Format

All errors follow:

```json
{
  "success": false,
  "message": "Error message here"
}
```