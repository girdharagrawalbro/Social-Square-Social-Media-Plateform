# High-Uptime Free Deployment Guide: Social Square

This guide provides the **best free-tier setup** with maximum uptime (minimizing service sleep) using Koyeb, Vercel, and Upstash.

## 1. Services Overview
- **Frontend**: [Vercel](https://vercel.com) (Global CDN, 100% uptime)
- **Backend**: [Koyeb](https://www.koyeb.com) (Nano instance - stays awake in select regions)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (M0 Free Cluster)
- **Redis**: [Upstash](https://upstash.com) (Serverless Redis - never sleeps)
- **NATS**: [Synadia Cloud (NGS)](https://app.synadia.com) (Managed NATS Free Tier)
- **Storage**: [Cloudinary](https://cloudinary.com)

---

## 2. Infrastructure Setup

### Step 2.1: Serverless Redis (Upstash)
1. Create a free account at [Upstash](https://upstash.com).
2. Create a **Redis** database.
3. Copy the **Redis URL** (e.g., `redis://default:password@name.upstash.io:6379`).
   > [!TIP]
   > Upstash is serverless and doesn't "sleep" like Render's internal Redis, making it much more reliable for free apps.

### Step 2.2: Managed NATS (Synadia)
1. Sign up for [Synadia Cloud](https://app.synadia.com).
2. Create a free account and get your **Client Credentials** or **Connect URL**.
3. Alternatively, if you prefer simplicity, keep using a Dockerized NATS on Koyeb (see below).

### Step 2.3: Backend Deployment (Koyeb)
Koyeb is a great alternative to Render because their **Nano** instances on Frankfurt/Washington regions stay alive.

1. Create an account on [Koyeb](https://www.koyeb.com).
2. Click **Create Service** > **GitHub**.
3. Select your repo and set the **Work Directory** to `backend`.
4. Set **Instance Type** to `Nano`.
5. **Environment Variables**:
   - `MONGO_URI`: `mongodb+srv://...`
   - `REDIS_URL`: URL from Upstash (Step 2.1)
   - `NATS_URL`: `nats://demo.nats.io:4222` (or your Synadia URL)
   - `JWT_SECRET`, `NVIDIA_API_KEY`, `GEMINI_API_KEY`, etc.
6. Set the **Health Check** and **Port** to `5000`.

---

## 3. Worker Strategy
Since free tiers often limit you to one service, you can run the **Worker** inside the same process as the Backend for the free tier:

Modify [backend/index.js](file:///d:/new/Social-Square-Social-Media-Plateform/backend/index.js) (Optional):
```javascript
// At the bottom of index.js
if (process.env.NODE_ENV === 'production') {
    require('./workers/imageWorker'); 
}
```
This ensures your AI image processing runs without needing a separate paid "Background Worker" instance.

---

## 4. Keeping it Awake (The "Pro" Hack)
Even with Koyeb/Render, free instances might sleep after 15 mins of inactivity.
1. Sign up for [Cron-job.org](https://cron-job.org).
2. Create a new cron job.
3. Set the URL to your backend health check: `https://your-api.koyeb.app/health`.
4. Set it to run every **10 minutes**.
5. This "pings" your server to keep it warm 24/7.

---

## 5. Frontend (Vercel)
1. Standard deployment to Vercel pointing to the new Koyeb URL.
2. Update `REACT_APP_BACKEND_URL` in Vercel to `https://your-api.koyeb.app`.

---

## 6. Verification
1. Login to the app.
2. Check if **AI Magic** works instantly without the "first-request delay" (thanks to the cron-pinger).
