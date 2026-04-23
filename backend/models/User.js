const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  profile_picture: {
    type: String,
    default: "https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain",
  },
  bio: { type: String, default: null },
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  googleId: { type: String, default: null },
  githubId: { type: String, default: null },
  authProvider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorOtp: { type: String, default: null },
  twoFactorOtpExpires: { type: Date, default: null },

  // Admin
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  creatorTier: { type: String, enum: ['none', 'creator', 'pro'], default: 'none' },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: null },
  bannedAt: { type: Date, default: null },

  // User Preferences
  preferredMood: {
    type: String,
    default: null,
    trim: true,
    set: v => (v === "" ? null : v),
    enum: ['happy', 'excited', 'funny', 'romantic', 'inspirational', 'calm', 'nostalgic', 'sad', null]
  },
  isPrivate: { type: Boolean, default: false },
  followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dismissedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Verification
  isEmailVerified: { type: Boolean, default: true },
  emailVerificationToken: { type: String, default: null },
  emailVerificationTokenSentAt: { type: Date, default: null },

  // Analytics
  profileViews: { type: Number, default: 0 },

  // User Preferences
  notificationSettings: {
    emailDigest: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: true },
  },

  // Presence
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },

  // Gamification
  streak: {
    count: { type: Number, default: 0 },
    lastPostDate: { type: Date, default: null }
  },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },

  // Welcome State
  hasSeenWelcome: { type: Boolean, default: false },

  created_at: { type: Date, default: Date.now },
});


UserSchema.index({ fullname: 1 });

module.exports = mongoose.model('User', UserSchema);