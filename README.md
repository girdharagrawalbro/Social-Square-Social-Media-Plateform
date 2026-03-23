# Social Square - AI-Powered Social Media Platform

Social Square is a modern, feature-rich social media platform that leverages cutting-edge AI to enhance user creativity and engagement.

## ✨ Key Features

### 🤖 AI-Powered Post Creation
Create stunning posts in seconds with our integrated AI tools:
- **AI Magic (✨) Button**: Easily generate high-quality captions and images directly from a prompt.
- **NVIDIA AI Integration**: Uses NVIDIA's Llama 3 for text and Stable Diffusion (SDXL) for image generation.
- **Intelligent Fallback**: Robust architecture that automatically switches between NVIDIA and Gemini models to ensure maximum uptime.
- **Daily AI Limits**: Fair-usage policy with 2 AI-generated posts per user every 24 hours.
- **Model Transparency**: Real-time feedback on which AI model was used for each generation.

### 🎭 Advanced Posting Options
- **Anonymous Confessions**: Share your thoughts without revealing your identity.
- **Time-Locked Posts**: Schedule posts to unlock at a specific date and time.
- **Auto-Delete (Burn after reading)**: Set posts to expire after 1, 6, or 24 hours (up to 1 week).
- **Collaborative Posts**: Invite friends to co-author and contribute to your posts.
- **Voice Notes**: Attach voice recordings to your posts for a more personal touch.
- **Mood Detection**: AI automatically detects the mood of your caption and categorizes your post.

## 🛠️ Technology Stack

### Backend
- **Core**: Node.js & Express
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io for instant notifications and updates
- **AI Utilities**: NVIDIA AI Foundation Models, Google Gemini 2.0
- **Cloud Storage**: Cloudinary for images and voice notes
- **Security**: JWT Authentication, Rate Limiting, Helmet.js

### Frontend
- **Framework**: React.js
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Styling**: Vanilla CSS with modern aesthetics
- **UI Components**: Custom reusable components with PrimeIcons

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB
- Cloudinary Account
- NVIDIA API Key
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/girdharagrawalbro/Social-Square-Social-Media-Plateform.git
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   # Create a .env file based on the provided template
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd socialsquare
   npm install
   # Create a .env file with REACT_APP_BACKEND_URL
   npm start
   ```

## 📝 Configuration

Ensure your `.env` in the `backend` directory contains:
```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
NVIDIA_API_KEY=your_nvidia_key
GEMINI_API_KEY=your_gemini_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_UPLOAD_PRESET=socialsquare
```

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

---
Built with ❤️ by Girdhar Agrawal & Team.
