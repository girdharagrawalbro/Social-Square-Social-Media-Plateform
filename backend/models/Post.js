const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    user: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      fullname: { type: String, required: true },
      profile_picture: { type: String },
    },
    // Hidden field to track the real author even for anonymous posts (optional for high-anonymity posts)
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, select: false },
    image_url: { type: String, default: null },
    image_urls: [{ type: String }],
    video: { type: String, default: null },
    videoThumbnail: { type: String, default: null },
    caption: { type: String, maxLength: 500 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      emoji: { type: String, default: '❤️' }
    }],
    comments: [],
    visibility: { type: String, enum: ['public', 'followers', 'close_friends'], default: 'public' },
    category: { type: String, required: true },
    tags: [{ type: String }],
    location: { name: { type: String, default: null }, lat: { type: Number, default: null }, lng: { type: Number, default: null } },
    music: { title: { type: String, default: null }, artist: { type: String, default: null } },
    score: { type: Number, default: 0 },

    // Post Expiry — auto-deleted by MongoDB TTL index
    expiresAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },

    // Anonymous Confessions — hides user identity
    isAnonymous: { type: Boolean, default: false },

    // Time-Locked — hidden until unlocksAt
    unlocksAt: { type: Date, default: null },

    // Collaborative Posts
    isCollaborative: { type: Boolean, default: false },
    collaborators: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      fullname: { type: String },
      profile_picture: { type: String },
      status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
      contribution: { type: String, default: null },
    }],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Voice Notes
    voiceNote: { url: { type: String, default: null }, duration: { type: Number, default: null } },

    // AI mood tag
    mood: { type: String, default: null },

    // Track AI posts
    isAiGenerated: { type: Boolean, default: false },

    // Analytics
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    
    // AI Pre-computed Summary for 3s Dwell Feature
    aiSummary: { type: String, default: null },

    // Interactive Polls & Quizzes
    poll: {
      question: { type: String, default: null },
      options: [{
        text: { type: String, required: true },
        votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
      }],
      correctOptionIndex: { type: Number, default: null }, // Sets it as a quiz
      expiresAt: { type: Date, default: null }
    },

    // Group / Community
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },

    // Security: One-way HMAC of owner ID (for anonymous posts)
    ownerToken: { type: String, select: false },

    // Before / After Post Format
    isBeforeAfter: { type: Boolean, default: false },
    beforeAfter: {
      beforeUrl: { type: String, default: null },
      afterUrl: { type: String, default: null },
      beforeLabel: { type: String, default: 'Before' },
      afterLabel: { type: String, default: 'After' },
      type: { type: String, enum: ['image', 'code', 'text'], default: 'image' },
      beforeText: { type: String, default: null },
      afterText: { type: String, default: null }
    },

    // Feedback Request Format
    isFeedbackRequest: { type: Boolean, default: false },
    feedbackCategory: { type: String, enum: ['design', 'code', 'writing', 'general', null], default: null },

    // Linked Goal
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null },

    // Reading time and depth score
    readingTime: { type: Number, default: 0 },
    depthScore: { type: String, enum: ['quick_take', 'deep_dive', 'long_read'], default: 'quick_take', index: true },

    // ─── MODERATION FIELDS ────────────────────────────────────────────────────
    isVisible: { type: Boolean, default: true, index: true },
    isFlagged: { type: Boolean, default: false, index: true },
    moderationScore: { type: Number, default: 0 },
    moderationReason: { type: String, default: null },
  },
  { timestamps: true }
);

// Pre-save hook to calculate reading time and depth score
PostSchema.pre('save', function (next) {
  const isTextOnly = !this.image_url && (!this.image_urls || this.image_urls.length === 0) && !this.video && (!this.voiceNote || !this.voiceNote.url);

  let text = (this.caption || '') + ' ';
  if (this.poll) {
    text += (this.poll.question || '') + ' ';
    if (this.poll.options) {
      text += this.poll.options.map(o => o.text || '').join(' ') + ' ';
    }
  }
  if (this.isBeforeAfter && this.beforeAfter) {
    text += (this.beforeAfter.beforeText || '') + ' ';
    text += (this.beforeAfter.afterText || '') + ' ';
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  this.readingTime = isTextOnly ? Math.ceil(wordCount / 200) : 0;

  if (wordCount < 50) {
    this.depthScore = 'quick_take';
  } else if (wordCount >= 50 && wordCount <= 200) {
    this.depthScore = 'deep_dive';
  } else {
    this.depthScore = 'long_read';
  }

  next();
});

// Global protection for anonymous posts (when not using .lean())
const { sanitizeAnonymousPost } = require('../utils/privacy');
PostSchema.set('toJSON', {
  transform: (doc, ret) => {
    return sanitizeAnonymousPost(ret);
  }
});
PostSchema.set('toObject', {
  transform: (doc, ret) => {
    return sanitizeAnonymousPost(ret);
  }
});


PostSchema.index({ createdAt: -1 });
PostSchema.index({ score: -1, createdAt: -1 });
PostSchema.index({ category: 1 });
PostSchema.index({ 'user._id': 1 });
PostSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

// Optimal Compound Indexes
PostSchema.index({ 'user._id': 1, createdAt: -1 });   // User posts feed
PostSchema.index({ category: 1, createdAt: -1 });      // Category filtering
PostSchema.index({ isAnonymous: 1, score: -1 });       // Confessions feed
PostSchema.index({ deletedAt: 1, isVisible: 1, createdAt: -1 }); // Main feed
PostSchema.index({ groupId: 1, createdAt: -1 });       // Group posts

module.exports = mongoose.model('Post', PostSchema);