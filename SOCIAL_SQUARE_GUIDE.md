# Social Square - User Guide

## 1️⃣ HOW TO CREATE A GROUP (Community)

### Step-by-Step Process:

1. **Open the app** and navigate the sidebar
2. **Click on "Communities"** icon or go to Groups section
3. **Click the "+ Create Group" button** (top right of the Communities page)
   
### In the Create Group Modal:
- **Group Name**: Enter a name for your community (required)
  - Example: "Photography Lovers", "Tech Enthusiasts", "Local Food"
- **Description**: Write what your group is about (optional)
  - Example: "A place to share and discuss photography tips"
- **Private/Public**: By default, groups are public (visible to everyone)
  - To make it private: Check the "Private" option (if available)

4. **Click "Create Group"** to submit

### After Creation:
- ✅ You automatically become the **group founder/admin**
- ✅ You and others can **post in the group**
- ✅ Other users can **search and join** your group
- ✅ Members can **view all group posts** in the group feed
- ✅ You can **leave** the group anytime

### Key Features:
- **All members** can post to the group
- **Group posts** appear separately in the group section
- **Members** are listed in the group details

---

## 2️⃣ VIDEO UPLOAD ISSUES - FIXED ✅

### Problem You Were Seeing:
**"Please add a caption or at least one image!"**

This error appeared because the validation only checked for:
- Caption text ✓
- Images ✓

But **it didn't check for videos** ✗

### Solution Applied:
✅ **Updated validation** - Now you can post with:
- Caption + images
- Caption + video
- **Video alone** (no caption required)
- **Images alone** (no caption required)
- **Caption alone** (with or without media)

### Video Upload Features:
✅ **Original Resolution**: Videos upload in original quality
✅ **No Cropping**: Videos are NOT cropped or compressed
✅ **Max 30 seconds**: Videos must be ≤ 30 seconds
✅ **Max 100MB**: File size limit (Cloudinary limit)

### To Upload Video to Post:
1. Click **Create Post** button
2. Click the **📷 image icon** or drag & drop
3. Select your video file
4. Video preview appears
5. **Optional**: Add caption for context
6. Click **Send** to post

### To Upload Video to Story:
1. Click **Your Story** (top of feed)
2. Click **+ Create Story**
3. Click the upload area or select file
4. Select your video file
5. **Optional**: Add text overlay (caption)
6. Click **Share Story**

---

## 3️⃣ VIDEO NOT SHOWING ON FEED - TROUBLESHOOTING

### Why Videos Might Not Display:

**A) Upload Validation Issues:**
- ❌ Only images uploaded (working)
- ❌ Video is > 30 seconds (not allowed) - will show error
- ❌ Video file is corrupted (won't upload)
- ❌ File size > 100MB (Cloudinary limit)

**B) Cloudinary Upload Errors:**
- ✅ Check Cloudinary account is active
- ✅ Verify API credentials in `.env` file

**C) Backend Issues:**
- ✅ Post exists in database but video field is null
- ✅ Video URL not saved properly

### How to Fix:

1. **Check File Format:**
   - Supported: MP4, WebM, Mov, Avi, Mkv, Flv, 3gp, Wmv, Ogv
   - Video codec: H.264 minimum

2. **Check File Size:**
   - Less than 100MB (recommended)
   - 30 seconds max

3. **Check Network:**
   - Upload should take 10-60 seconds depending on file size
   - Watch the progress indicator

4. **Retry Upload:**
   - Close modal and try again
   - Use a smaller video file
   - Try different video format

---

## 4️⃣ VOTE SYSTEM EXPLANATION

### What is the Vote System?

The vote system lets users create **polls** and **quizzes** in posts where followers can vote/answer.

### Two Modes:

#### 📊 **POLL MODE** (Regular Voting)
- Users vote on multiple choice options
- No correct answer
- See real-time vote counts
- Can view who voted what

**Example Poll:**
```
"What's your favorite content type?"
- Photos (25 votes)
- Videos (40 votes)
- Stories (18 votes)
- Reels (35 votes)
```

#### 📝 **QUIZ MODE** (With Correct Answer)
- Users answer a question
- One answer is marked as "correct"
- Users can see if they got it right
- Shows leaderboard of correct answerers

**Example Quiz:**
```
"Capital of France?"
- London
- Berlin
- Paris ✅ (CORRECT)
- Madrid
```

### How to Create a Poll/Quiz:

1. **Open Create Post modal**
2. **Click the 📊 icon** at the bottom (Poll button)
3. **Toggle mode**: 
   - **Poll Mode** (default) - no correct answer
   - **Quiz Mode** - select correct answer

4. **Add Options:**
   - Minimum 2 options
   - Maximum 5 options
   - Click "+ Add Option" to add more
   - Click the **X** to remove an option

5. **For Quiz Mode:**
   - Click the **numbered circle** on the option you want as correct
   - It will turn **green** with a ✓ mark
   - The option is now marked as correct answer

6. **Post Creation:**
   - Add caption and media (optional)
   - Click **Send** to create post with poll/quiz

### How Users Vote:

1. **See Poll/Quiz** in their feed
2. **Click on an option** to vote
3. **Results update** instantly
4. **Can view** poll details and analytics

### Vote System Rules:

✅ **One vote per person** - Users can only vote once per poll
✅ **Expiration** (optional) - Set poll to expire after time
❌ **Cannot change vote** - Once voted, choice is locked
✅ **Anonymous voting** (in development) - Options coming soon

### Vote Rewards (Gamification):

- Each vote = **1 point** toward user rank
- Can lead to unlock rewards/badges
- Contributes to post engagement score

---

## 📝 Summary Checklist:

- ✅ **Groups**: Create via Communities tab, invite members, post together
- ✅ **Videos**: Upload in original resolution, no cropping, supports up to 30 seconds, no caption required
- ✅ **Feed**: Videos display when properly uploaded; check file size < 100MB
- ✅ **Polls/Quizzes**: Use 📊 button in Create Post, set correct answer for quiz mode, one vote per person

---

## 🆘 Still Having Issues?

**For Video Upload:**
- Try a smaller file (< 50MB)
- Use MP4 format
- Check internet connection
- Clear browser cache

**For Group Creation:**
- Refresh page after creating
- Check if you appear as admin in members list

**For Poll/Quiz:**
- Ensure minimum 2 options
- Select correct answer BEFORE posting (Quiz mode)
- Wait for refresh to see poll results

---

**Last Updated:** April 2, 2026 | Social Square Guides
