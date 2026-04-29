const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    user: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      fullname: { type: String, required: true },
      profile_picture: { type: String },
    },
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
    category: { type: String, required: true },
    tags: [{ type: String }],
    location: { name: { type: String, default: null }, lat: { type: Number, default: null }, lng: { type: Number, default: null } },
    music: { title: { type: String, default: null }, artist: { type: String, default: null } },
    score: { type: Number, default: 0 },

    // Post Expiry — auto-deleted by MongoDB TTL index
    expiresAt: { type: Date, default: null },

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

    // Voice Notes
    voiceNote: { url: { type: String, default: null }, duration: { type: Number, default: null } },

    // AI mood tag
    mood: { type: String, default: null },

    // Track AI posts
    isAiGenerated: { type: Boolean, default: false },

    // Analytics
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },

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
  },
  { timestamps: true }
);


PostSchema.index({ createdAt: -1 });
PostSchema.index({ score: -1, createdAt: -1 });
PostSchema.index({ category: 1 });
PostSchema.index({ 'user._id': 1 });
PostSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Post', PostSchema);