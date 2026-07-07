# AI Integration

## Overview
Social Square uses AI to assist creators and moderate content, providing a safe and engaging environment.

## Workflows

### AI Caption Generation
- **Trigger**: User uploads an image but leaves the caption blank.
- **Process**: The image is analyzed by a Vision AI model which identifies context, mood, and objects.
- **Result**: The API suggests 3 contextual captions with relevant hashtags for the user to select.

### AI Content Classification
- **Trigger**: New post is published.
- **Process**: Natural Language Processing (NLP) runs asynchronously via BullMQ on the post content.
- **Result**: Post is categorized (e.g., Tech, Lifestyle, Art) to improve feed recommendations.

### AI Moderation
- **Trigger**: Post creation or comment submission.
- **Process**: Content is synchronously scanned against safety models for toxicity, hate speech, or NSFW imagery.
- **Result**: Violating content is either blocked from being posted or flagged for manual review depending on the confidence score.

### AI Image Detection
- **Trigger**: Image upload.
- **Process**: Heuristic and AI models scan the image for copyright infringements or deepfakes.
- **Result**: Watermarks applied or warnings issued.

### AI Recommendations (Feed)
- **Trigger**: User scroll/feed request.
- **Process**: A recommendation engine analyzes the user's past interactions (likes, time spent on posts) to curate the `cursor` feed.
