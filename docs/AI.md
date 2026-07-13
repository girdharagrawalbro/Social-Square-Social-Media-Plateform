# AI Integration Architecture

Social Square integrates state-of-the-art AI systems to assist creators with content generation, automate safety moderation, analyze user moods, and power recommendation feeds.

---

## 1. AI Generation & Vision Analysis

### Image-Based Caption Generation
* **Trigger**: The user uploads an image inside the Create Post modal but leaves the AI Prompt text field blank, clicking **Generate Text**.
* **Engine**: Nvidia Multimodal API (`meta/llama-3.2-11b-vision-instruct` model).
* **Process**: 
  1. If the selected image is not yet uploaded, it is uploaded to Cloudinary to obtain a secure URL.
  2. The frontend sends the image URL to `POST /api/ai/caption`.
  3. The vision model analyzes the image's context, mood, and objects.
* **Output**: Returns 3 engaging caption alternatives complete with 2-3 contextual hashtags. The user can select their favorite to populate the post caption.

### Text-to-Post Magic Generation
* **Trigger**: User inputs a text prompt in **AI Magic Tools** and selects **Generate Magic Post**.
* **Engine**: Nvidia Text Model (`meta/llama-3.1-8b-instruct`) and Llama 3.2 Vision.
* **Process**: Asynchronously triggers text generation, image creation, and metadata classification in parallel:
  - Generates a short, engaging caption.
  - Generates a high-quality, cinematic image.
  - Suggests relevant tags, mood, and a categorized taxonomy.

---

## 2. Automated Content Moderation & Safety

Automated moderation runs asynchronously via **BullMQ** (powered by Redis, falling back to an in-memory handler if Redis is disabled).

### Text Toxicity Check
* **Local Profanity Check**: Employs a dynamic profanity check (`bad-words` module) on the post or comment text to intercept common prohibited words.
* **AI Toxicity Classification**: Scores toxicity between `0.0` (safe) and `1.0` (toxic/harassment) using Nvidia safety instructions.
* **Moderation Thresholds**:
  - `score >= 0.8` (or profane and `score > 0.5`): Post is auto-hidden (`isVisible: false`), flagged, and logged.
  - `score >= 0.6`: Hidden and queued for administrator manual review.
  - `score >= 0.4` (or contains profanity): Flagged and hidden from public view.

### Image Moderation (Computer Vision)
* **Service**: Sightengine API (`nudity-2.0` model).
* **Process**: Scans uploaded post images for nudity, explicit displays, erotica, and suggestive imagery.
* **Actions**: 
  - **Hide** (sexual activity/display > 0.5): Automatically hides the post and records the policy violation.
  - **Flag** (erotica > 0.5 or suggestive > 0.85): Restricts post visibility and marks it for manual verification.

### Audit Trail
All automated flags, hides, and overrides are logged into the `AuditLog` collection, providing a transparent, chronological ledger for admins.

---

## 3. Post Classification & Metadata Suggestion

* **Endpoint**: `/api/ai/suggest-meta`
* **Trigger**: Triggered during Magic Post creation or requested manually.
* **Process**: An AI classifier maps the text content against the database's available category taxonomy (e.g. Travel, Tech, Food, Art) and generates:
  - An **improved, concise caption** (max 220 chars).
  - A clean set of **5 to 8 unique hashtags**.
  - A designated **category taxonomy** for feed matching.

---

## 4. Mood Analysis & Mood Feed

* **Mood Detection**: Captions are analyzed and classified into one of 10 moods: `happy`, `sad`, `excited`, `angry`, `calm`, `romantic`, `funny`, `inspirational`, `nostalgic`, or `neutral`.
* **Mood-Based Feed**: Users can filter their feed based on their current mood. The system maps the query mood to related mood families:
  - `happy` maps to `happy`, `excited`, `funny`.
  - `sad` maps to `sad`, `nostalgic`.
  - `excited` maps to `excited`, `happy`, `inspirational`.
  - *And so on...*

---

## 5. Post Summarization

* **Trigger**: Runs during the background moderation pipeline.
* **Process**: If a post is visible and has a caption longer than 10 characters, the AI generates a highly condensed 1-2 sentence preview summary (`aiSummary`).
* **Usage**: Provides quick hover-over previews in the feed UI without requiring users to open full details.
